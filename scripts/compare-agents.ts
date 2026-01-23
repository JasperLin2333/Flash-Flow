/**
 * Agent Compare Test Script
 * 
 * 对比 /api/plan (Legacy) 和 /api/agent/plan (Agent) 的生成质量
 * 
 * 使用方法:
 * 1. 启动开发服务器: npm run dev
 * 2. 运行脚本: npx tsx scripts/compare-agents.ts
 */

import { WorkflowZodSchema } from "../src/lib/schemas/workflow";

// ============ Configuration ============
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = process.env.AUTH_TOKEN || ""; // 需要设置认证 Token

// ============ Test Cases ============
const TEST_CASES = [
    // 基础翻译场景
    "创建一个简单的翻译工作流，把中文翻译成英文",

    // 多节点场景
    "设计一个工作流：用户输入一段文字，先进行内容审核，审核通过后翻译成英文，最后输出",

    // 图片生成场景
    "创建一个根据用户描述生成图片的工作流",

    // RAG 场景
    "设计一个知识问答工作流，从知识库中检索相关内容后回答用户问题",

    // 分支场景
    "创建一个工作流：判断用户输入的语言，如果是中文就翻译成英文，如果是英文就翻译成中文",

    // Phase 3: 测试主动建议
    "帮我做一个翻译工具",  // 期望: 建议添加人工审核
    "生成一张猫的图片",    // 期望: 建议添加负面提示词
];

// ============ Types ============
interface SSEResult {
    title: string;
    nodes: unknown[];
    edges: unknown[];
    toolCalls: { tool: string; args: unknown }[];
    suggestions: string[];  // Phase 3: Track suggestions
    errors: string[];
}

interface CompareResult {
    prompt: string;
    legacy: {
        valid: boolean;
        nodeCount: number;
        edgeCount: number;
        errors: string[];
        duration: number;
    };
    agent: {
        valid: boolean;
        nodeCount: number;
        edgeCount: number;
        toolCallCount: number;
        errors: string[];
        duration: number;
    };
}

// ============ SSE Parser ============
async function parseSSEStream(response: Response): Promise<SSEResult> {
    const result: SSEResult = {
        title: "",
        nodes: [],
        edges: [],
        toolCalls: [],
        suggestions: [],
        errors: [],
    };

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        try {
            const parsed = JSON.parse(data);

            if (parsed.type === "result") {
                result.title = parsed.title || "";
                result.nodes = parsed.nodes || [];
                result.edges = parsed.edges || [];
            } else if (parsed.type === "tool-call") {
                result.toolCalls.push({ tool: parsed.tool, args: parsed.args });
            } else if (parsed.type === "suggestion") {
                result.suggestions.push(parsed.content);
            } else if (parsed.type === "error") {
                result.errors.push(parsed.message);
            }
        } catch {
            // Ignore parse errors for progress chunks
        }
    }

    return result;
}

// ============ Validation ============
function validateFlow(nodes: unknown[], edges: unknown[]): { valid: boolean; errors: string[] } {
    try {
        WorkflowZodSchema.parse({ nodes, edges });
        return { valid: true, errors: [] };
    } catch (error) {
        const zodError = error as { errors?: Array<{ message: string }> };
        return {
            valid: false,
            errors: zodError.errors?.map(e => e.message) || ["Unknown validation error"],
        };
    }
}

// ============ API Callers ============
async function callLegacyApi(prompt: string): Promise<SSEResult & { duration: number }> {
    const start = Date.now();

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    // Use test user header in development mode (no AUTH_TOKEN needed)
    if (!AUTH_TOKEN) {
        headers["x-flash-test-user"] = "true";
    } else {
        headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
    }

    const response = await fetch(`${BASE_URL}/api/plan`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt }),
    });

    const result = await parseSSEStream(response);
    return { ...result, duration: Date.now() - start };
}

async function callAgentApi(prompt: string): Promise<SSEResult & { duration: number }> {
    const start = Date.now();

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    // Use test user header in development mode (no AUTH_TOKEN needed)
    if (!AUTH_TOKEN) {
        headers["x-flash-test-user"] = "true";
    } else {
        headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
    }

    const response = await fetch(`${BASE_URL}/api/agent/plan`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt }),
    });

    const result = await parseSSEStream(response);
    return { ...result, duration: Date.now() - start };
}

// ============ Main Compare Function ============
async function compareEndpoints(): Promise<CompareResult[]> {
    const results: CompareResult[] = [];

    console.log("🚀 Starting Agent Comparison Test\n");
    console.log("=".repeat(60));

    for (let i = 0; i < TEST_CASES.length; i++) {
        const prompt = TEST_CASES[i];
        console.log(`\n[${i + 1}/${TEST_CASES.length}] Testing: "${prompt.slice(0, 40)}..."`);

        try {
            // Call Legacy API
            console.log("  📦 Calling Legacy API...");
            const legacyResult = await callLegacyApi(prompt);
            const legacyValidation = validateFlow(legacyResult.nodes, legacyResult.edges);

            // Call Agent API
            console.log("  🤖 Calling Agent API...");
            const agentResult = await callAgentApi(prompt);
            const agentValidation = validateFlow(agentResult.nodes, agentResult.edges);

            const compareResult: CompareResult = {
                prompt,
                legacy: {
                    valid: legacyValidation.valid,
                    nodeCount: legacyResult.nodes.length,
                    edgeCount: legacyResult.edges.length,
                    errors: legacyValidation.errors,
                    duration: legacyResult.duration,
                },
                agent: {
                    valid: agentValidation.valid,
                    nodeCount: agentResult.nodes.length,
                    edgeCount: agentResult.edges.length,
                    toolCallCount: agentResult.toolCalls.length,
                    errors: agentValidation.errors,
                    duration: agentResult.duration,
                },
            };

            results.push(compareResult);

            // Print summary for this test
            console.log(`  Legacy: ${legacyValidation.valid ? "✅" : "❌"} | Nodes: ${legacyResult.nodes.length} | ${legacyResult.duration}ms`);
            console.log(`  Agent:  ${agentValidation.valid ? "✅" : "❌"} | Nodes: ${agentResult.nodes.length} | Tools: ${agentResult.toolCalls.length} | ${agentResult.duration}ms`);

        } catch (error) {
            console.error(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
            results.push({
                prompt,
                legacy: { valid: false, nodeCount: 0, edgeCount: 0, errors: ["API call failed"], duration: 0 },
                agent: { valid: false, nodeCount: 0, edgeCount: 0, toolCallCount: 0, errors: ["API call failed"], duration: 0 },
            });
        }
    }

    return results;
}

// ============ Report Generator ============
function generateReport(results: CompareResult[]): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 COMPARISON REPORT");
    console.log("=".repeat(60));

    const legacyValidCount = results.filter(r => r.legacy.valid).length;
    const agentValidCount = results.filter(r => r.agent.valid).length;
    const totalToolCalls = results.reduce((sum, r) => sum + r.agent.toolCallCount, 0);
    const avgLegacyDuration = results.reduce((sum, r) => sum + r.legacy.duration, 0) / results.length;
    const avgAgentDuration = results.reduce((sum, r) => sum + r.agent.duration, 0) / results.length;

    console.log(`\n📈 Overall Stats:`);
    console.log(`  Total Tests: ${results.length}`);
    console.log(`  Legacy Valid: ${legacyValidCount}/${results.length} (${(legacyValidCount / results.length * 100).toFixed(1)}%)`);
    console.log(`  Agent Valid:  ${agentValidCount}/${results.length} (${(agentValidCount / results.length * 100).toFixed(1)}%)`);
    console.log(`  Agent Tool Calls: ${totalToolCalls} total (avg ${(totalToolCalls / results.length).toFixed(1)} per test)`);
    console.log(`  Avg Legacy Duration: ${avgLegacyDuration.toFixed(0)}ms`);
    console.log(`  Avg Agent Duration:  ${avgAgentDuration.toFixed(0)}ms`);

    // Detailed errors
    const failedTests = results.filter(r => !r.legacy.valid || !r.agent.valid);
    if (failedTests.length > 0) {
        console.log(`\n❌ Failed Tests:`);
        for (const test of failedTests) {
            console.log(`  - "${test.prompt.slice(0, 40)}..."`);
            if (!test.legacy.valid) console.log(`    Legacy: ${test.legacy.errors.join(", ")}`);
            if (!test.agent.valid) console.log(`    Agent:  ${test.agent.errors.join(", ")}`);
        }
    }

    // Recommendation
    console.log(`\n💡 Recommendation:`);
    if (agentValidCount > legacyValidCount) {
        console.log(`  ✅ Agent API shows improved validation rate. Consider migrating.`);
    } else if (agentValidCount === legacyValidCount) {
        console.log(`  ⚖️ Same validation rate. Agent provides self-correction capability.`);
    } else {
        console.log(`  ⚠️ Agent API has lower validation rate. Review tool implementation.`);
    }
}

// ============ Entry Point ============
async function main() {
    if (!AUTH_TOKEN) {
        console.warn("⚠️ Warning: AUTH_TOKEN not set. API calls may fail.");
        console.log("Set it via: AUTH_TOKEN=your_token npx tsx scripts/compare-agents.ts\n");
    }

    const results = await compareEndpoints();
    generateReport(results);
}

main().catch(console.error);
