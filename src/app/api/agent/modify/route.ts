import OpenAI from "openai";
export const runtime = 'edge';

import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from "@/lib/quotaEdge";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { CORE_RULES, MODIFY_PROMPT, NODE_REFERENCE, VARIABLE_RULES, EDGE_RULES } from "@/lib/prompts";

// ============ Agent Configuration ============
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL || "deepseek-chat";
const MAX_RETRIES = 2;

// ============ System Prompts ============
function buildPatchModePrompt(currentNodes: unknown[], currentEdges: unknown[]): string {
    const compactNodes = (currentNodes as Array<{
        id: string;
        type: string;
        data?: { label?: string;[key: string]: unknown };
    }>).map(n => ({
        id: n.id,
        type: n.type,
        label: n.data?.label || n.type,
    }));

    return `你是 Flash Flow Agent，专门负责修改现有工作流。

## 🎯 核心使命
根据用户的修改需求，对现有工作流进行精准的增量修改。

### 第一步：思考分析 (必须先输出)
在生成任何 JSON 之前，你必须先在 <thinking> 标签中输出你的分析过程：
<thinking>
1. 用户想修改什么？
2. 需要修改哪些节点？
3. 是否需要添加/删除节点？
4. 变量引用是否受影响？
</thinking>

### 第二步：生成 JSON
分析完成后，生成修改指令。

## 📋 当前工作流上下文

### 节点列表 (精简版)
\`\`\`json
${JSON.stringify(compactNodes, null, 2)}
\`\`\`

### 边列表
\`\`\`json
${JSON.stringify(currentEdges, null, 2)}
\`\`\`

## 📐 修改原则
- **最小改动**: 仅输出需要变更的字段
- **精准定位**: nodeId 必须对应上方节点 ID
- **保留未修改**: 不要输出未改变的节点

## 📝 输出格式 (JSON)

### 修改节点 (Patch)
\`\`\`json
{"patches": [{"nodeId": "llm_main", "data": {"temperature": 0.2}}]}
\`\`\`

### 添加节点 (Add)
\`\`\`json
{"action": "add", "nodeType": "tool", "nodeData": {...}, "connectAfter": "parent_id"}
\`\`\`

### 删除节点 (Delete)
\`\`\`json
{"action": "delete", "target": "node_id"}
\`\`\`

${NODE_REFERENCE}

${VARIABLE_RULES}`;
}

function buildFullModePrompt(currentNodes: unknown[], currentEdges: unknown[]): string {
    return `你是 Flash Flow Agent，专门负责修改现有工作流。

## 🎯 核心使命
根据用户的修改需求，生成修改后的完整工作流 JSON。

### 第一步：思考分析 (必须先输出)
在生成任何 JSON 之前，你必须先在 <thinking> 标签中输出你的分析过程：
<thinking>
1. 用户想修改什么？
2. 需要修改哪些节点？
3. 数据流动是否需要调整？
4. 变量引用是否需要更新？
</thinking>

### 第二步：生成 JSON
分析完成后，生成修改后的完整工作流。

## 📋 当前工作流上下文
\`\`\`json
${JSON.stringify({ nodes: currentNodes, edges: currentEdges }, null, 2)}
\`\`\`

## 🧠 修改原则
1. **最小改动**: 仅修改用户明确要求的部分
2. **精准定位**: 根据 label 或 type 锁定目标节点
3. **ID 保持**: 必须保留原有节点的 ID
4. **完整闭环**: 输出必须是完整的 JSON (nodes + edges)

${MODIFY_PROMPT}

${CORE_RULES}

${NODE_REFERENCE}

${VARIABLE_RULES}

${EDGE_RULES}

## 📝 输出格式
输出**修改后的完整工作流** JSON：
\`\`\`json
{"title": "...", "nodes": [...], "edges": [...]}
\`\`\``;
}

// ============ Main Handler ============
export async function POST(req: Request) {
    const reqClone = req.clone();

    try {
        // Authentication check
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return unauthorizedResponse();
        }

        // Server-side quota check
        const pointsCheck = await checkPointsOnServer(req, user.id, "flow_generation");
        if (!pointsCheck.allowed) {
            return pointsExceededResponse(pointsCheck.balance, pointsCheck.required);
        }

        const body = await reqClone.json();
        const { prompt, currentNodes, currentEdges, mode = "full" } = body;

        if (!prompt?.trim() || !currentNodes || !currentEdges) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Get model and provider
        const modelName = DEFAULT_MODEL;
        const provider = getProviderForModel(modelName);
        const config = PROVIDER_CONFIG[provider];

        const client = new OpenAI({
            apiKey: config.getApiKey(),
            baseURL: config.baseURL,
        });

        // Select system prompt based on mode
        const systemPrompt = mode === "patch"
            ? buildPatchModePrompt(currentNodes, currentEdges)
            : buildFullModePrompt(currentNodes, currentEdges);

        // Create streaming response
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                let success = false;
                let lastError: string | null = null;
                let attempt = 0;
                let accumulatedText = "";

                const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `请根据以下需求修改工作流:\n\n${prompt}` },
                ];

                while (!success && attempt < MAX_RETRIES) {
                    try {
                        const completion = await client.chat.completions.create({
                            model: modelName,
                            temperature: 0.2,
                            messages,
                            stream: true,
                            // Note: JSON mode removed to allow <thinking> tags
                            // JSON is extracted manually from the response
                        });

                        accumulatedText = "";
                        let thinkingEmitted = false;

                        for await (const chunk of completion) {
                            const content = chunk.choices?.[0]?.delta?.content || "";
                            if (content) {
                                accumulatedText += content;

                                // Detect thinking tags (same logic as plan/route.ts)
                                if (!thinkingEmitted && accumulatedText.includes("<thinking>") && !accumulatedText.includes("</thinking>")) {
                                    if (!accumulatedText.slice(0, -content.length).includes("<thinking>")) {
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({ type: "thinking-start" })}\n\n`)
                                        );
                                    }
                                }

                                if (!thinkingEmitted && accumulatedText.includes("</thinking>")) {
                                    const thinkingMatch = accumulatedText.match(/<thinking>([\s\S]*?)<\/thinking>/);
                                    if (thinkingMatch) {
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({
                                                type: "thinking",
                                                content: thinkingMatch[1].trim()
                                            })}\n\n`)
                                        );
                                        thinkingEmitted = true;
                                    }
                                    controller.enqueue(
                                        encoder.encode(`data: ${JSON.stringify({ type: "thinking-end" })}\n\n`)
                                    );
                                }

                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ type: "progress", content })}\n\n`)
                                );
                            }
                        }

                        // Parse result
                        let parsedResult: {
                            title?: string;
                            nodes?: unknown[];
                            edges?: unknown[];
                            patches?: unknown[];
                            action?: string;
                        } = {};

                        try {
                            // Remove thinking tags before JSON extraction
                            let cleanedText = accumulatedText.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
                            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                parsedResult = JSON.parse(jsonMatch[0]);
                            }
                        } catch {
                            lastError = "Failed to parse JSON";
                            attempt++;
                            continue;
                        }

                        // Validate basic structure based on mode
                        if (mode === "patch") {
                            if (parsedResult.patches && Array.isArray(parsedResult.patches) && parsedResult.patches.length > 0) {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: "result",
                                        mode: "patch",
                                        patches: parsedResult.patches,
                                        action: parsedResult.action,
                                    })}\n\n`)
                                );
                                await deductPointsOnServer(req, user.id, "flow_generation", null, "Flow 生成");
                                success = true;
                            } else if (parsedResult.action) {
                                // Add or delete action
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: "result",
                                        mode: "patch",
                                        ...parsedResult,
                                    })}\n\n`)
                                );
                                await deductPointsOnServer(req, user.id, "flow_generation", null, "Flow 生成");
                                success = true;
                            } else {
                                lastError = "No valid patches or action found";
                                attempt++;
                            }
                        } else {
                            // Full mode - check for nodes/edges
                            if (parsedResult.nodes && Array.isArray(parsedResult.nodes) && parsedResult.nodes.length > 0) {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: "result",
                                        mode: "full",
                                        title: parsedResult.title || "Modified Workflow",
                                        nodes: parsedResult.nodes,
                                        edges: parsedResult.edges || [],
                                    })}\n\n`)
                                );
                                await deductPointsOnServer(req, user.id, "flow_generation", null, "Flow 生成");
                                success = true;
                            } else {
                                lastError = "No valid nodes found";
                                attempt++;
                            }
                        }

                    } catch (error) {
                        lastError = error instanceof Error ? error.message : "Unknown error";
                        attempt++;
                    }
                }

                if (!success) {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                            type: "error",
                            message: lastError || "Modification failed"
                        })}\n\n`)
                    );
                }

                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (e) {
        console.error("[Agent Modify API] Error:", e);
        return new Response(
            JSON.stringify({ error: "Failed to process modification" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
