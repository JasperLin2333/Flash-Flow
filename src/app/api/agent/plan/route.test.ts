
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/authEdge';
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from '@/lib/quotaEdge';

// Mocks
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

describe('Agent Plan Route Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreate.mockReset();

        delete process.env.FLOW_VALIDATION_REPORT_ENABLED;
        delete process.env.FLOW_VALIDATION_SAFE_FIX_ENABLED;
        delete process.env.FLOW_SAFE_FIX_REMOVE_INVALID_EDGES;
        delete process.env.FLOW_SAFE_FIX_DEDUPE_EDGES;
        delete process.env.FLOW_SAFE_FIX_ENSURE_EDGE_IDS;
        delete process.env.FLOW_SAFE_FIX_ID_TO_LABEL;

        // Default Auth Mock
        (getAuthenticatedUser as any).mockResolvedValue({ id: 'user_123' });

        // Default Quota Mock
        (checkPointsOnServer as any).mockResolvedValue({ allowed: true, balance: 100, required: 10 });
        (deductPointsOnServer as any).mockResolvedValue(true);
    });

    // Helper to create a mock stream
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
        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' })
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
        expect(unauthorizedResponse).toHaveBeenCalled();
    });

    it('should return 403 if quota exceeded', async () => {
        (checkPointsOnServer as any).mockResolvedValue({ allowed: false, balance: 0, required: 10 });
        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test' })
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
        expect(pointsExceededResponse).toHaveBeenCalled();
    });

    it('should handle Phase 1 (Analysis) returning <plan>', async () => {
        const planContent = `
<plan>
## 需求理解
用户想要测试功能
## 工作流结构
- [type:input] 输入: 用户输入
- [type:llm] LLM: 处理数据
- [type:output] 输出: 结果
## 适用场景
- 单元测试
## 使用方法
1. 运行测试
</plan>`;
        mockCreate.mockResolvedValue(createStream(['<step type="analysis">Thinking...</step>', planContent]));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test', enableClarification: true })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            result += decoder.decode(value);
        }

        // Verify Plan Event
        expect(result).toContain('"type":"plan"');
        expect(result).toContain('"userPrompt":"用户想要测试功能"');
        expect(result).toContain('"workflowNodes":');
        expect(result).toContain('"label":"LLM"');
        expect(result).toContain('[DONE]');
    });

    it('should handle Phase 2 (Generation) returning valid JSON', async () => {
        const jsonContent = JSON.stringify({
            title: "Test Flow",
            nodes: [
                { id: '1', type: 'input', data: { label: 'Input' } },
                { id: '2', type: 'llm', data: { label: 'LLM', prompt: '{{Input.text}}' } },
                { id: '3', type: 'output', data: { label: 'Output' } }
            ],
            edges: [
                { source: '1', target: '2' },
                { source: '2', target: '3' }
            ]
        });
        
        const streamContent = [
            '<step type="strategy">Planning...</step>',
            '<step type="verification">Verifying...</step>',
            'Here is the JSON:',
            '```json',
            jsonContent,
            '```'
        ];
        
        mockCreate.mockResolvedValue(createStream(streamContent));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test [PLAN_CONFIRMED]' })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            result += decoder.decode(value);
        }

        // Verify JSON Event
        expect(result).toContain('"type":"result"');
        expect(result).toContain('"nodes":');
        expect(result).toContain('"edges":');
        // Verify Deduct Points was called
        expect(deductPointsOnServer).toHaveBeenCalled();
    });

    it('should parse the last JSON block when model outputs multiple versions', async () => {
        const oldJson = JSON.stringify({
            title: "Old Flow",
            nodes: [
                { id: '1', type: 'llm', data: { label: 'LLM', prompt: 'hi' } }
            ],
            edges: []
        });
        const newJson = JSON.stringify({
            title: "New Flow",
            nodes: [
                { id: '1', type: 'input', data: { label: 'Input' } },
                { id: '2', type: 'llm', data: { label: 'LLM', prompt: '{{Input.text}}' } },
                { id: '3', type: 'output', data: { label: 'Output' } }
            ],
            edges: [
                { source: '1', target: '2' },
                { source: '2', target: '3' }
            ]
        });

        mockCreate.mockResolvedValue(createStream([
            'First draft:\n```json\n',
            oldJson,
            '\n```\nSecond (fixed):\n```json\n',
            newJson,
            '\n```'
        ]));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test [PLAN_CONFIRMED]' })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            result += decoder.decode(value);
        }

        expect(result).toContain('"type":"result"');
        expect(result).toContain('"title":"New Flow"');
        expect(result).toContain('"type":"output"');
    });

    it('should auto-fill missing input/output nodes deterministically', async () => {
        const jsonContent = JSON.stringify({
            title: "No IO Flow",
            nodes: [
                { id: 'n1', type: 'llm', data: { label: 'LLM', prompt: 'hi' } }
            ],
            edges: []
        });

        mockCreate.mockResolvedValue(createStream(['```json\n', jsonContent, '\n```']));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test [PLAN_CONFIRMED]', skipAutomatedValidation: false })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            result += decoder.decode(value);
        }

        expect(result).toContain('"title":"No IO Flow"');
        expect(result).toContain('"type":"input"');
        expect(result).toContain('"type":"output"');
    });

    it('should run automated validation when skipAutomatedValidation is omitted', async () => {
        const jsonContent = JSON.stringify({
            title: "No IO Flow",
            nodes: [
                { id: 'n1', type: 'llm', data: { label: 'LLM', prompt: 'hi' } }
            ],
            edges: []
        });

        mockCreate.mockResolvedValue(createStream(['```json\n', jsonContent, '\n```']));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test [PLAN_CONFIRMED]' })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const raw = await readSse(res);
        expect(raw).toContain('"type":"input"');
        expect(raw).toContain('"type":"output"');
    });

    it('should fallback to Direct Mode if Phase 1 fails to generate <plan>', async () => {
        // First attempt fails (no <plan> tag)
        // Second attempt fails (retry logic in route)
        // Then fallback to Direct Mode (which we simulate by returning JSON in 3rd call, or just checking the logs/logic)
        
        // Mock sequence of responses
        // 1. Analysis Prompt -> No Plan
        // 2. Retry Prompt -> No Plan
        // 3. Direct Mode Prompt -> JSON
        
        const jsonContent = JSON.stringify({ 
            nodes: [
                { id: '1', type: 'input', data: { label: 'Input' } },
                { id: '2', type: 'output', data: { label: 'Output' } }
            ],
            edges: [
                { source: '1', target: '2' }
            ]
        });
        
        mockCreate
            .mockResolvedValueOnce(createStream(['Thinking without plan...'])) // 1st try
            .mockResolvedValueOnce(createStream(['Still no plan...'])) // 2nd try (PLAN_MAX_RETRIES=2)
            .mockResolvedValueOnce(createStream(['```json', jsonContent, '```'])); // 3rd try (Fallback)

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test', enableClarification: true })
        });

        const res = await POST(req);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            result += decoder.decode(value);
        }

        expect(result).toContain('"stepType":"fallback"');
        expect(result).toContain('规划阶段未产出有效计划');
        expect(result).toContain('"type":"result"');
    });

    it('should apply safe fix without emitting validation steps by default', async () => {
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

        mockCreate.mockResolvedValue(createStream(['```json\n', jsonContent, '\n```']));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test [PLAN_CONFIRMED]' })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const raw = await readSse(res);
        expect(raw).not.toContain('"stepType":"validation"');
        expect(raw).not.toContain('"stepType":"validation_fix"');

        const events = parseSseEvents(raw);
        const result = events.find((e) => e.type === 'result');
        expect(result).toBeTruthy();
        expect(result.nodes).toHaveLength(3);
        expect(result.edges.some((e: any) => e.id === 'bad')).toBe(false);

        const llm = result.nodes.find((n: any) => n.id === "llm_1");
        expect(String(llm?.data?.systemPrompt)).toContain('{{用户输入.user_input}}');
        expect(String(llm?.data?.systemPrompt)).not.toContain('{{用户输入.text}}');
    });

    it('should emit validation steps when report is enabled', async () => {
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

        mockCreate.mockResolvedValue(createStream(['```json\n', jsonContent, '\n```']));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test [PLAN_CONFIRMED]' })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const raw = await readSse(res);
        expect(raw).toContain('"stepType":"validation"');
        expect(raw).toContain('"stepType":"validation_fix"');
    });

    it('should not block result when validateWorkflow reports schema errors', async () => {
        process.env.FLOW_VALIDATION_SAFE_FIX_ENABLED = 'true';

        const jsonContent = JSON.stringify({
            title: "Invalid Node Type Flow",
            nodes: [
                { id: 'bad_1', type: 'foo', data: { label: 'Bad' } }
            ],
            edges: []
        });

        mockCreate.mockResolvedValue(createStream(['```json\n', jsonContent, '\n```']));

        const req = new Request('http://localhost/api/agent/plan', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'test [PLAN_CONFIRMED]', skipAutomatedValidation: false })
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const raw = await readSse(res);
        expect(raw).toContain('"type":"result"');
        expect(raw).not.toContain('逻辑校验失败');
    });
});
