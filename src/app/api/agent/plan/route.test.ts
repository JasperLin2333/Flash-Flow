
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/authEdge';
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from '@/lib/quotaEdge';
import OpenAI from 'openai';

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
                { id: '2', type: 'llm', data: { label: 'LLM', prompt: '{{Input.text}}' } }
            ],
            edges: [
                { source: '1', target: '2' }
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

    it('should fallback to Direct Mode if Phase 1 fails to generate <plan>', async () => {
        // First attempt fails (no <plan> tag)
        // Second attempt fails (retry logic in route)
        // Then fallback to Direct Mode (which we simulate by returning JSON in 3rd call, or just checking the logs/logic)
        
        // Mock sequence of responses
        // 1. Analysis Prompt -> No Plan
        // 2. Retry Prompt -> No Plan
        // 3. Direct Mode Prompt -> JSON
        
        const jsonContent = JSON.stringify({ 
            nodes: [{ id: '1', type: 'input' }], 
            edges: [] 
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
});
