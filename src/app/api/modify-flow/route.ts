import { NextResponse } from "next/server";
export const runtime = 'edge';
import OpenAI from "openai";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkQuotaOnServer, incrementQuotaOnServer, quotaExceededResponse } from "@/lib/quotaEdge";
import { CORE_RULES, MODIFY_PROMPT, NODE_REFERENCE, VARIABLE_RULES, EDGE_RULES } from "@/lib/prompts";
import { WorkflowZodSchema } from "@/lib/schemas/workflow";

// ============ Patch Mode Handler ============
async function handlePatchMode(
  prompt: string,
  currentNodes: any[],
  currentEdges: any[],
  client: OpenAI,
  model: string
) {
  // 构建精简的节点上下文（只显示关键信息）
  const compactNodes = currentNodes.map(n => ({
    id: n.id,
    type: n.type,
    label: n.data?.label || n.type,
    // 只保留可修改的核心配置
    config: {
      ...(n.type === 'llm' && {
        model: n.data?.model,
        temperature: n.data?.temperature,
        enableMemory: n.data?.enableMemory,
        memoryMaxTurns: n.data?.memoryMaxTurns,
        responseFormat: n.data?.responseFormat,
        systemPrompt: n.data?.systemPrompt?.slice(0, 100) + '...',
      }),
      ...(n.type === 'input' && {
        enableTextInput: n.data?.enableTextInput,
        enableFileInput: n.data?.enableFileInput,
        enableStructuredForm: n.data?.enableStructuredForm,
      }),
      ...(n.type === 'rag' && {
        fileMode: n.data?.fileMode,
        inputMappings: n.data?.inputMappings,
      }),
      ...(n.type === 'imagegen' && {
        model: n.data?.model,
        cfg: n.data?.cfg,
        numInferenceSteps: n.data?.numInferenceSteps,
        referenceImageMode: n.data?.referenceImageMode,
      }),
      ...(n.type === 'branch' && {
        condition: n.data?.condition,
      }),
      ...(n.type === 'tool' && {
        toolType: n.data?.toolType,
      }),
    }
  }));

  const patchPrompt = `你是工作流修改专家。根据用户需求，精准输出需要修改的节点配置。

# 当前节点 (精简版)
\`\`\`json
${JSON.stringify(compactNodes, null, 2)}
\`\`\`

# 用户需求
${prompt}

# 修改指南 (Intent Mapping)
| 用户意图 | 目标节点 | 修改建议 (参考) |
|---------|---------|----------------|
| **"加记忆"** | LLM | \`enableMemory: true\`, \`memoryMaxTurns: 10\` |
| **"更严谨"** | LLM | \`temperature: 0.1\` |
| **"更有创意"** | LLM | \`temperature: 0.9\` |
| **"切换模型"** | LLM | \`model: "deepseek-reasoner"\` (如需推理) |
| **"输出 JSON"** | LLM | \`responseFormat: "json_object"\` (务必同时修改 SystemPrompt) |
| **"上传文件"** | Input | \`enableFileInput: true\`, \`fileConfig: { allowedTypes: [".pdf"], ... }\` |
| **"搜集表单"** | Input | \`enableStructuredForm: true\`, \`formFields: [...]\` |
| **"修改分支"** | Branch | \`condition: "{{A.score}} > 60"\` (确保使用 {{}} 引用变量) |

# 输出规则 (Strict Rules)
1. **最小修改原则**: 仅输出需要变更的字段。
2. **ID 绝对一致**: \`nodeId\` 必须精准对应上方提供的节点 ID。
3. **LLM 提示词规范**: 若修改 SystemPrompt，必须使用 Markdown 格式 (Role/Task/Constraints)。
4. **数据类型**: 严格遵守 TypeScript 定义 (e.g. numeric fields must be numbers).

# 输出格式 (JSON Patches)
\`\`\`json
{
  "patches": [
    { "nodeId": "llm_main", "data": { "temperature": 0.2 } },
    { "nodeId": "input_root", "data": { "greeting": "欢迎咨询！" } }
  ]
}
\`\`\`

# 添加节点 (Add Action)
\`\`\`json
{
  "action": "add",
  "nodeType": "tool",
  "nodeData": {
    "label": "联网搜索",
    "toolType": "web_search",
    "inputs": { "query": "{{Input.user_input}}", "maxResults": 5 }
  },
  "connectAfter": "parent_node_id" // 将插入在此节点之后
}
\`\`\`

# 删除节点 (Delete Action)
\`\`\`json
{
  "action": "delete",
  "target": "node_id_to_delete"
}
\`\`\`
`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: patchPrompt },
      { role: "user", content: "请分析需求并生成 JSON 指令。" },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices?.[0]?.message?.content || "{}";

  try {
    return JSON.parse(content);
  } catch {
    // 解析失败，返回空以触发 fallback
    return { error: "parse_failed" };
  }
}

// ============ Full Mode Handler (复用 plan 提示词结构) ============
async function handleFullMode(
  prompt: string,
  currentNodes: any[],
  currentEdges: any[],
  client: OpenAI,
  model: string
) {
  const currentWorkflowJSON = JSON.stringify(
    { nodes: currentNodes, edges: currentEdges },
    null,
    2
  );

  // 复用 plan/route.ts 的提示词结构，添加修改专用上下文
  const system = `你是工作流修改专家。根据用户的修改需求，基于当前工作流上下文，精准生成修改后的完整 JSON 工作流。

# 📋 当前工作流上下文
\`\`\`json
${currentWorkflowJSON}
\`\`\`

# 🧠 核心原则 (Modification Principles)

1. **最小改动 (Minimalism)**: 仅修改用户明确要求的部分，严禁随意重构未提及的逻辑。
2. **精准定位 (Targeting)**: 根据 label 或 type 锁定目标节点。
   - 用户说 "翻译节点" -> 匹配 label="翻译"
   - 用户说 "LLM" -> 匹配 type="llm"
3. **ID 保持 (Identity Preservation)**: 必须保留原有节点的 ID，确保前端视图稳定。
4. **完整闭环 (Completeness)**: 输出必须是完整的 JSON (nodes + edges)，包含所有未修改的节点。

${MODIFY_PROMPT}

${CORE_RULES}

${NODE_REFERENCE}

${VARIABLE_RULES}

${EDGE_RULES}

# ✅ 修改检查清单 (Sanity Check)
1. ⚠️ **连线完整性**: 新增节点是否已正确连接？删除节点是否清理了悬空边？
2. ⚠️ **变量引用**: 修改引用时是否使用了正确的 label? (e.g. \`{{Label.field}}\`)
3. ⚠️ **LLM配置**: 是否为 LLM 节点配置了 \`inputMappings.user_input\`?



# 输出格式
输出**修改后的完整工作流** JSON（保留未修改的节点）：
\`\`\`json
{"title": "...", "nodes": [...], "edges": [...]}
\`\`\`
`;

  const finalSystemPrompt = system + "\\n\\n# 用户请求\\n" + prompt;
  const userMsg = "请按照 system prompt 中的规则解析用户需求并生成 JSON 指令。";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: userMsg },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices?.[0]?.message?.content || "{}";

  let jsonText = content;
  const match = content.match(/\{[\s\S]*\}/);
  if (match) jsonText = match[0];

  try {
    const instruction = JSON.parse(jsonText);

    // Validation logging
    const validation = WorkflowZodSchema.safeParse(instruction);
    if (!validation.success && process.env.NODE_ENV === 'development') {
      console.warn("Modify-Flow Schema Validation Failed:", validation.error);
    }

    return instruction;
  } catch {
    return { action: "unknown" };
  }
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
    const quotaCheck = await checkQuotaOnServer(req, user.id, "flow_generations");
    if (!quotaCheck.allowed) {
      return quotaExceededResponse(quotaCheck.used, quotaCheck.limit, "Flow 生成次数");
    }

    const body = await reqClone.json();
    // mode 默认为 "full" 保持向后兼容
    const { prompt, currentNodes, currentEdges, mode = "full" } = body;

    if (!prompt || !currentNodes || !currentEdges) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Dynamic provider resolution
    const defaultModel = process.env.DEFAULT_LLM_MODEL || "deepseek-ai/DeepSeek-V3.2";
    const provider = getProviderForModel(defaultModel);
    const config = PROVIDER_CONFIG[provider];

    const client = new OpenAI({
      apiKey: config.getApiKey(),
      baseURL: config.baseURL
    });

    // 根据 mode 选择处理方式
    let result: any;
    if (mode === "patch") {
      result = await handlePatchMode(prompt, currentNodes, currentEdges, client, defaultModel);

      // 如果 patch 模式解析失败，返回特殊标记让前端 fallback
      if (result.error === "parse_failed") {
        result = await handleFullMode(prompt, currentNodes, currentEdges, client, defaultModel);
      }
    } else {
      // Full mode（原有逻辑）
      result = await handleFullMode(prompt, currentNodes, currentEdges, client, defaultModel);
    }

    // Increment quota after successful modification
    await incrementQuotaOnServer(req, user.id, "flow_generations");

    return NextResponse.json(result);
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Modify flow error:", e);
    }
    return NextResponse.json({ error: "Failed to process modification" }, { status: 500 });
  }
}