import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, currentNodes, currentEdges } = body;

        if (!prompt || !currentNodes || !currentEdges) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();

        // 构建当前工作流的完整 JSON 上下文
        const currentWorkflowJSON = JSON.stringify(
            {
                nodes: currentNodes,
                edges: currentEdges,
            },
            null,
            2
        );

        const system = `
# Role
You are a **Workflow Mutation Engine**. Your goal is to analyze the User's modification request against the **Current Workflow Context** and generate a precise JSON instruction to update the graph.

# Context (Current Workflow State)
The current graph structure is:
\`\`\`json
${currentWorkflowJSON} 
// 👆 开发者注意：调用时请在此处注入当前工作流的完整JSON字符串
// 如果没有当前JSON，模型将无法解析 "target": "node_id"
\`\`\`

# Task
Map the user's natural language request to one of the allowed actions.

# Supported Actions & Schema (TypeScript)
Return a JSON object satisfying this interface:

\`\`\`typescript
type ActionType = 'add' | 'delete' | 'modify' | 'reorder';

interface MutationInstruction {
  action: ActionType;
  target?: string;    // The EXACT Node ID targeted (resolve from Context based on user desc)
  position?: 'before' | 'after'; // For 'add' or 'reorder'
  nodeType?: 'input' | 'llm' | 'rag' | 'http' | 'output'; // For 'add'
  
  // For 'add': Full node config (auto-generate ID, strict fields like previous rules)
  // For 'modify': Only fields to update
  nodeData?: Partial<Node>; 
  
  // For 'reorder': The reference node ID to move relative to
  referenceNode?: string; 
}
\`\`\`

# Logic & Constraints
1.  **ID Resolution (CRITICAL)**: 
    * If user says "Delete the translation node", look at the **Context**, find the node with label/type matching "translation", and use its actual \`id\` (e.g., "llm_b29a") as the \`target\`.
    * Do NOT return descriptions like "node-2" unless that is the actual ID.
2.  **'add' Action Rules**:
    * \`.nodeData\` MUST be complete and valid (e.g., \`text: ""\` for input, \`systemPrompt\` in Chinese for LLM).
    * Logic: If user says "Add RAG after Input", set \`target\` = Input's ID, \`position\` = "after".
3.  **'modify' Action Rules**:
    * \`.nodeData\` should only contain changed fields (Partial update).
    * Example: "Change model to gpt-4" -> \`{ action: "modify", target: "...", nodeData: { model: "gpt-4" } }\`
4.  **Output Format**: Raw JSON only. No Markdown.

# User Request
{user_request}
`;

        // 将用户请求注入到 system prompt 中
        const finalSystemPrompt = system.replace("{user_request}", prompt);

        const userMsg = "请按照 system prompt 中的规则解析用户需求并生成 JSON 指令。";

        let content = "{}";

        if (provider === "doubao") {
            const model = process.env.DOUBAO_MODEL || "doubao-pro-128k";
            const apiKey = process.env.DOUBAO_API_KEY || "";
            const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: "system", content: finalSystemPrompt },
                        { role: "user", content: userMsg },
                    ],
                    temperature: 0.1,
                }),
            });
            const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
            content = data?.choices?.[0]?.message?.content || "{}";
        } else {
            const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
            const completion = await client.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0.1,
                messages: [
                    { role: "system", content: finalSystemPrompt },
                    { role: "user", content: userMsg },
                ],
            });
            content = completion.choices?.[0]?.message?.content || "{}";
        }

        // 提取JSON
        let jsonText = content;
        const match = content.match(/\{[\s\S]*\}/);
        if (match) jsonText = match[0];

        let instruction: any = {};
        try {
            instruction = JSON.parse(jsonText);
        } catch {
            instruction = { action: "unknown" };
        }

        return NextResponse.json(instruction);
    } catch (e) {
        console.error("Modify flow error:", e);
        return NextResponse.json({ error: "Failed to process modification" }, { status: 500 });
    }
}
