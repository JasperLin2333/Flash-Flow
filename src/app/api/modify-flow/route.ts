import { NextResponse } from "next/server";
export const runtime = 'edge';
import OpenAI from "openai";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkQuotaOnServer, incrementQuotaOnServer, quotaExceededResponse } from "@/lib/quotaEdge";
import { SMART_RULES, VARIABLE_RULES, NODE_SPECS, EDGE_RULES, CORE_CHECKLIST, EFFICIENCY_RULES } from "@/lib/prompts";
import { WorkflowZodSchema } from "@/lib/schemas/workflow";

export async function POST(req: Request) {
  // Clone request for quota operations
  const reqClone = req.clone();

  try {
    // Authentication check
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    // Server-side quota check for flow generations
    const quotaCheck = await checkQuotaOnServer(req, user.id, "flow_generations");
    if (!quotaCheck.allowed) {
      return quotaExceededResponse(quotaCheck.used, quotaCheck.limit, "Flow 生成次数");
    }

    const body = await reqClone.json();
    const { prompt, currentNodes, currentEdges } = body;

    if (!prompt || !currentNodes || !currentEdges) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 构建当前工作流的完整 JSON 上下文
    const currentWorkflowJSON = JSON.stringify(
      {
        nodes: currentNodes,
        edges: currentEdges,
      },
      null,
      2
    );

    const system = `你是工作流修改专家。根据用户的修改需求，基于当前工作流上下文，精准生成修改后的完整 JSON 工作流。

# 📋 当前工作流上下文
\`\`\`json
${currentWorkflowJSON}
\`\`\`

# 🧠 核心原则

1. **最小改动**: 仅修改用户明确要求的部分，保留其他配置不变。
2. **精准定位**: 根据节点 label 或 type 精准定位目标节点（禁止猜测）。
3. **完整输出**: 输出修改后的**完整工作流** JSON（包含所有节点和边）。

${SMART_RULES}

${EFFICIENCY_RULES}

## 🎯 修改意图识别

| 用户可能说 | 修改操作 | 目标定位 |
|-----------|---------|----------|
| "让它记住对话/加记忆" | 修改 LLM 节点 | \`enableMemory: true\` |
| "更准确/更稳定" | 修改 LLM 节点 | \`temperature: 0.1-0.3\` |
| "加上文件上传/支持图片" | 修改 Input 节点 | \`enableFileInput: true\` |
| "加个分支/分流处理" | 添加 Branch 节点 | 插入到指定位置 |
| "删掉这个节点" | 删除节点 | 同时删除相关边 |
| "把XX改成YY" | 修改节点属性 | 更新 label/prompt 等 |
| "加个搜索功能" | 添加 Tool 节点 | \`toolType: web_search\` |

> 🔵 **定位规则**: 用户说"翻译节点" → 找 label 包含"翻译"的节点；说"LLM" → 找 type=llm 的节点


${VARIABLE_RULES}

${NODE_SPECS}

${EDGE_RULES}

# ✅ 修改操作检查清单
1. ⚠️ 修改后的节点 ID 必须与原工作流保持一致
2. ⚠️ 新增节点需正确连接上下游边
3. ⚠️ 删除节点时需同时删除相关边

${CORE_CHECKLIST}

# 输出格式
输出**修改后的完整工作流** JSON（保留未修改的节点）：
\`\`\`json
{"title": "...", "nodes": [...], "edges": [...]}
\`\`\`
`;

    // 将用户请求注入到 system prompt 中
    const finalSystemPrompt = system + "\\n\\n# 用户请求\\n" + prompt;

    const userMsg = "请按照 system prompt 中的规则解析用户需求并生成 JSON 指令。";

    let content = "{}";

    // Dynamic provider resolution
    const defaultModel = process.env.DEFAULT_LLM_MODEL || "deepseek-ai/DeepSeek-V3.2";
    const provider = getProviderForModel(defaultModel);
    const config = PROVIDER_CONFIG[provider];

    const client = new OpenAI({
      apiKey: config.getApiKey(),
      baseURL: config.baseURL
    });
    const completion = await client.chat.completions.create({
      model: defaultModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    });
    content = completion.choices?.[0]?.message?.content || "{}";

    // 提取JSON
    let jsonText = content;
    // With JSON mode, match is less critical but kept as safety layer
    const match = content.match(/\{[\s\S]*\}/);
    if (match) jsonText = match[0];

    let instruction: any = {};
    try {
      instruction = JSON.parse(jsonText);

      // Strict validation logging
      // Note: modify-flow might return instruction object OR workflow, 
      // but current prompt says "输出修改后的完整工作流 JSON", so valid workflow is expected.
      const validation = WorkflowZodSchema.safeParse(instruction);
      if (!validation.success) {
        if (process.env.NODE_ENV === 'development') {
          console.warn("Modify-Flow Schema Validation Failed:", validation.error);
        }
      }

    } catch {
      instruction = { action: "unknown" };
    }

    // Increment quota after successful modification
    await incrementQuotaOnServer(req, user.id, "flow_generations");

    return NextResponse.json(instruction);
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Modify flow error:", e);
    }
    return NextResponse.json({ error: "Failed to process modification" }, { status: 500 });
  }
}