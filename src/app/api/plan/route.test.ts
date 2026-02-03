import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/authEdge';
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from '@/lib/quotaEdge';

const mockCreate = vi.fn();

vi.mock('@/lib/authEdge', () => ({
    getAuthenticatedUser: vi.fn(),
    unauthorizedResponse: vi.fn(() => new Response('Unauthorized', { status: 401 })),
}));

vi.mock('@/lib/quotaEdge', () => ({
    checkPointsOnServer: vi.fn(),
    deductPointsOnServer: vi.fn(),
    pointsExceededResponse: vi.fn(() => new Response('Quota Exceeded', { status: 403 })),
}));

vi.mock('@/lib/llmProvider', () => ({
    getProviderForModel: vi.fn(() => 'mock'),
    PROVIDER_CONFIG: {
        mock: {
            getApiKey: () => 'test',
            baseURL: 'http://localhost',
        }
    },
}));

vi.mock('openai', () => {
    return {
        default: class {
            chat = {
                completions: {
                    create: mockCreate
                }
            }
        }
    };
});

describe('Plan Route Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreate.mockReset();

        delete process.env.FLOW_VALIDATION_REPORT_ENABLED;
        delete process.env.FLOW_VALIDATION_SAFE_FIX_ENABLED;
        delete process.env.FLOW_SAFE_FIX_REMOVE_INVALID_EDGES;
        delete process.env.FLOW_SAFE_FIX_DEDUPE_EDGES;
        delete process.env.FLOW_SAFE_FIX_ENSURE_EDGE_IDS;
        delete process.env.FLOW_SAFE_FIX_ID_TO_LABEL;

        (getAuthenticatedUser as any).mockResolvedValue({ id: 'user_123' });
        (checkPointsOnServer as any).mockResolvedValue({ allowed: true, balance: 100, required: 10 });
        (deductPointsOnServer as any).mockResolvedValue(true);
    });

    const createStream = (chunks: string[]) => {
        return {
            [Symbol.asyncIterator]: async function* () {
                for (const chunk of chunks) {
                    yield { choices: [{ delta: { content: chunk } }] };
                }
            }
        };
    };

    const readSse = async (res: Response) => {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            result += decoder.decode(value);
        }
        return result;
    };

    const parseSseEvents = (raw: string) => {
        const events: any[] = [];
        const blocks = raw.split('\n\n').map((x) => x.trim()).filter(Boolean);
        for (const block of blocks) {
            const lines = block.split('\n').map((x) => x.trim()).filter(Boolean);
            for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const payload = line.slice('data:'.length).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    events.push(JSON.parse(payload));
                } catch {
                }
            }
        }
        return events;
    };

    it('should return 401 if user is not authenticated', async () => {
        (getAuthenticatedUser as any).mockResolvedValue(null);
        const req = new Request('http://localhost/api/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' })
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
        expect(unauthorizedResponse).toHaveBeenCalled();
    });

    it('should return 403 if quota exceeded', async () => {
        (checkPointsOnServer as any).mockResolvedValue({ allowed: false, balance: 0, required: 10 });
        const req = new Request('http://localhost/api/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' })
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
        expect(pointsExceededResponse).toHaveBeenCalled();
    });

    it('should apply safe fix without emitting validation events by default', async () => {
        process.env.FLOW_VALIDATION_SAFE_FIX_ENABLED = 'true';

        const jsonContent = JSON.stringify({
            title: "Test Flow",
            nodes: [
                { id: 'input_1', type: 'input', data: { label: '用户输入' } },
                { id: 'llm_1', type: 'llm', data: { label: 'LLM', model: 'gpt-4o-mini', systemPrompt: 'hello {{用户输入.text}}' } },
                { id: 'out_1', type: 'output', data: { label: '输出', inputMappings: { mode: 'direct', sources: [{ type: 'static', value: 'ok' }] } } }
            ],
            edges: [
                { id: 'e1', source: 'input_1', target: 'llm_1' },
                { id: 'bad', source: 'missing_node', target: 'out_1' }
            ]
        });

        mockCreate.mockResolvedValue(createStream([jsonContent]));

        const req = new Request('http://localhost/api/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const raw = await readSse(res);
        expect(raw).not.toContain('"type":"validation"');
        expect(raw).not.toContain('"type":"validation_fix"');

        const events = parseSseEvents(raw);
        const result = events.find((e) => e.type === 'result');
        expect(result).toBeTruthy();
        expect(result.nodes).toHaveLength(3);
        expect(result.edges.some((e: any) => e.id === 'bad')).toBe(false);

        const llm = result.nodes.find((n: any) => n.id === "llm_1");
        expect(String(llm?.data?.systemPrompt)).toContain('{{用户输入.user_input}}');
        expect(String(llm?.data?.systemPrompt)).not.toContain('{{用户输入.text}}');
    });

    it('should emit validation events when report is enabled', async () => {
        process.env.FLOW_VALIDATION_REPORT_ENABLED = 'true';
        process.env.FLOW_VALIDATION_SAFE_FIX_ENABLED = 'true';

        const jsonContent = JSON.stringify({
            title: "Test Flow",
            nodes: [
                { id: 'input_1', type: 'input', data: { label: '用户输入' } },
                { id: 'llm_1', type: 'llm', data: { label: 'LLM', model: 'gpt-4o-mini', systemPrompt: 'hello {{用户输入.text}}' } },
                { id: 'out_1', type: 'output', data: { label: '输出', inputMappings: { mode: 'direct', sources: [{ type: 'static', value: 'ok' }] } } }
            ],
            edges: [
                { id: 'e1', source: 'input_1', target: 'llm_1' },
                { id: 'bad', source: 'missing_node', target: 'out_1' }
            ]
        });

        mockCreate.mockResolvedValue(createStream([jsonContent]));

        const req = new Request('http://localhost/api/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const raw = await readSse(res);
        expect(raw).toContain('"type":"validation"');
        expect(raw).toContain('"type":"validation_fix"');
    });

    it('should not block result when validateWorkflow reports schema errors', async () => {
        const jsonContent = JSON.stringify({
            title: "Invalid Node Type Flow",
            nodes: [
                { id: 'bad_1', type: 'foo', data: { label: 'Bad' } }
            ],
            edges: []
        });

        mockCreate.mockResolvedValue(createStream([jsonContent]));

        const req = new Request('http://localhost/api/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test', skipAutomatedValidation: false })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const raw = await readSse(res);
        expect(raw).toContain('"type":"result"');
        expect(raw).not.toContain('Validation failed');
    });
});
