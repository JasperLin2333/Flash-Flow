import OpenAI from "openai";
export const runtime = 'edge';
import { PlanRequestSchema } from "@/utils/validation";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkQuotaOnServer, incrementQuotaOnServer, quotaExceededResponse } from "@/lib/quotaEdge";
import { SMART_RULES, VARIABLE_RULES, NODE_SPECS, EDGE_RULES, SCENARIO_RULES, CORE_CHECKLIST, EFFICIENCY_RULES } from "@/lib/prompts";
import { WorkflowZodSchema } from "@/lib/schemas/workflow";

// ============ 兜底策略配置 ============
const FALLBACK_MODEL = "gemini-3-flash-preview"; // 备选模型 (视觉+文本)
const MAX_RETRIES = 2; // 每个模型最大重试次数
const RETRY_DELAY_MS = 1000; // 重试延迟

/** 延迟函数 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 判断是否应该重试（可恢复性错误） */
function shouldRetry(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  // 超时、速率限制、服务暂时不可用 → 重试
  return msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed");
}

/** 判断是否应该切换到备选模型 */
function shouldFallback(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  // 5xx 错误（非暂时性）、模型不可用 → 切换备选
  return msg.includes("500") ||
    msg.includes("model not found") ||
    msg.includes("invalid model") ||
    msg.includes("unsupported");
}


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

    // 1. Validation
    const parseResult = PlanRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.format() }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { prompt } = parseResult.data;

    // 2. Early return for empty prompt
    if (!prompt.trim()) {
      return new Response(
        JSON.stringify({ nodes: [], edges: [] }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Files placeholder - knowledge base files are configured in the UI, not passed from frontend
    const files: { name: string; size?: number; type?: string }[] = [];

    // 3. Model configuration (reads from environment variable for easy updates)
    const preferredModel = process.env.DEFAULT_LLM_MODEL || "deepseek-ai/DeepSeek-V3.2";

    // Import shared prompt modules
    // Note: Constants are imported from '@/lib/prompts' at the top of the file

    const system = `你是工作流编排专家。根据用户需求描述，智能生成完整的 JSON 工作流。

# 🧠 核心原则

1. **逻辑深度**: LLM SystemPrompt 必须包含具体的核心业务逻辑（角色/目标/约束），拒绝空洞内容。
2. **场景适配**: 根据需求精准选择节点组合和参数。
3. **模糊兜底**: 需求不明确时，优先生成 Input → LLM → Output 三节点直链，在 LLM 的 systemPrompt 中引导用户补充信息。

${EFFICIENCY_RULES}

${SMART_RULES}

${SCENARIO_RULES}

${VARIABLE_RULES}

${NODE_SPECS}

${EDGE_RULES}

# 📋 关键示例

## 1. 🖼️ 图片分析 (Vision)
\`\`\`json
{"title": "工单OCR识别", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "上传工单", "enableFileInput": true, "fileConfig": {"allowedTypes": [".jpg",".png",".webp"], "maxCount": 1}}},
  {"id": "llm", "type": "llm", "data": {"label": "智能识别", "model": "deepseek-ai/DeepSeek-OCR", "temperature": 0.1, "enableMemory": false, "systemPrompt": "# 角色\\n你是工单识别专家，精通维修工单、物流单据的结构化提取。\\n\\n# 任务\\n分析图片 {{上传工单.files}}，提取关键字段。\\n\\n# 输出格式 (JSON)\\n{\\\"单号\\\": \\\"..\\\", \\\"日期\\\": \\\"YYYY-MM-DD\\\", \\\"客户\\\": \\\"..\\\", \\\"故障描述\\\": \\\"..\\\", \\\"状态\\\": \\\"待处理|已完成\\\"}\\n\\n# 约束\\n- 模糊字段标注 [无法识别]\\n- 日期转 ISO 格式\\"}},
  {"id": "out", "type": "output", "data": {"label": "识别结果", "inputMappings": {"mode": "direct", "sources": [{"type": "variable", "value": "{{智能识别.response}}"}]}}}
], "edges": [{"source": "in", "target": "llm"}, {"source": "llm", "target": "out"}]}
\`\`\`

## 2. 💰 智能理财 (Branch + Tool + 结构化表单)
\`\`\`json
{"title": "智能理财顾问", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "投资偏好", "enableStructuredForm": true, "formFields": [{"name": "risk", "label": "风险偏好", "type": "select", "options": ["保守型", "激进型"], "required": true}]}},
  {"id": "br", "type": "branch", "data": {"label": "策略分流", "condition": "投资偏好.formData.risk === '保守型'"}},
  {"id": "t_bond", "type": "tool", "data": {"label": "查询国债", "toolType": "web_search", "inputs": {"query": "2024年国债利率 最新收益率"}}},
  {"id": "t_stock", "type": "tool", "data": {"label": "查询美股", "toolType": "web_search", "inputs": {"query": "纳斯达克 科技股 本周涨幅榜"}}},
  {"id": "llm_safe", "type": "llm", "data": {"label": "稳健方案", "temperature": 0.3, "systemPrompt": "# 角色\\n你是 CFA 认证的保守型理财顾问，专注本金安全。\\n\\n# 任务\\n基于国债信息 {{查询国债.results}} 制定理财方案。\\n\\n# 输出要求\\n1. **推荐产品**: 2-3个低风险产品及预期年化\\n2. **配置建议**: 如 国债60%+货基40%\\n3. **风险提示**: 本金波动范围\\n\\n# 约束\\n- 年化不超5%\\n- 禁止推荐股票期货\\"}},
  {"id": "llm_risk", "type": "llm", "data": {"label": "激进方案", "temperature": 0.7, "systemPrompt": "# 角色\\n你是专注成长股的激进型投资顾问。\\n\\n# 任务\\n基于美股信息 {{查询美股.results}} 制定投资方案。\\n\\n# 输出要求\\n1. **推荐标的**: 3-5只高潜力股及理由\\n2. **仓位策略**: 分批建仓计划\\n3. **止损策略**: 明确止损点位(-15%)\\n\\n# 约束\\n- 必须包含风险警示\\n- 单只仓位≤20%\\"}},
  {"id": "out", "type": "output", "data": {"label": "投资方案", "inputMappings": {"mode": "select", "sources": [{"type": "variable", "value": "{{稳健方案.response}}"}, {"type": "variable", "value": "{{激进方案.response}}"}]}}}
], "edges": [
  {"source": "in", "target": "br"},
  {"source": "br", "target": "t_bond", "sourceHandle": "true"}, {"source": "br", "target": "t_stock", "sourceHandle": "false"},
  {"source": "t_bond", "target": "llm_safe"}, {"source": "t_stock", "target": "llm_risk"},
  {"source": "llm_safe", "target": "out"}, {"source": "llm_risk", "target": "out"}
]}
\`\`\`

${CORE_CHECKLIST}

# 输出格式
纯 JSON：
\`\`\`json
{"title": "...", "nodes": [...], "edges": [...]}
\`\`\`
`;

    const userMsg = [
      `用户描述: ${prompt}`,
      files.length ? `可用知识库文件: ${files.map(f => f.name).join(", ")}` : "无可用知识库文件",
    ].join("\n");

    // Create streaming response to avoid timeout
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const modelsToTry = [preferredModel, FALLBACK_MODEL];
        let lastError: unknown = null;
        let success = false;

        // 尝试每个模型
        for (let modelIndex = 0; modelIndex < modelsToTry.length && !success; modelIndex++) {
          const currentModel = modelsToTry[modelIndex];
          const isFallback = modelIndex > 0;

          // 通知切换到备选模型
          if (isFallback) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "fallback", model: currentModel })}\n\n`));
          }

          // 每个模型最多重试 MAX_RETRIES 次
          for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
            try {
              // 通知重试
              if (attempt > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "retrying", attempt: attempt + 1, model: currentModel })}\n\n`));
                await delay(RETRY_DELAY_MS);
              }

              const provider = getProviderForModel(currentModel);
              const config = PROVIDER_CONFIG[provider];

              const client = new OpenAI({
                apiKey: config.getApiKey(),
                baseURL: config.baseURL
              });

              const completion = await client.chat.completions.create({
                model: currentModel,
                temperature: 0.2,
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: userMsg },
                ],
                stream: true,
                response_format: { type: "json_object" }, // Added response_format
              });

              let fullContent = "";

              // Send progress updates to keep connection alive
              for await (const chunk of completion) {
                const content = chunk.choices?.[0]?.delta?.content || "";
                if (content) {
                  fullContent += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "progress", content })}\n\n`));
                }
              }

              // Parse the complete response
              let jsonText = fullContent;
              const match = fullContent.match(/\{[\s\S]*\}/);
              if (match) jsonText = match[0];

              let plan: { title?: string; nodes?: unknown; edges?: unknown } = {};
              try {
                plan = JSON.parse(jsonText) as { title?: string; nodes?: unknown; edges?: unknown };
              } catch (parseError) {
                // JSON 解析失败，可能需要重试
                lastError = new Error("Failed to parse LLM response as JSON");
                if (shouldRetry(lastError) && attempt < MAX_RETRIES - 1) {
                  continue; // 重试当前模型
                }
                // 切换到下一个模型
                break;
              }

              const title = plan?.title || prompt.slice(0, 20);
              const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
              const edges = Array.isArray(plan?.edges) ? plan.edges : [];

              // 检查是否生成了有效内容
              if (nodes.length === 0) {
                lastError = new Error("LLM returned empty nodes");
                if (attempt < MAX_RETRIES - 1) {
                  continue; // 重试
                }
                break; // 切换模型
              }

              // 成功！发送结果
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "result", title, nodes, edges })}\n\n`));
              await incrementQuotaOnServer(req, user.id, "flow_generations");
              success = true;

            } catch (error) {
              lastError = error;
              if (process.env.NODE_ENV === 'development') {
                console.error(`Plan generation error (model: ${currentModel}, attempt: ${attempt + 1}):`, error);
              }

              // 判断是否应该重试当前模型
              if (shouldRetry(error) && attempt < MAX_RETRIES - 1) {
                continue; // 重试
              }

              // 判断是否应该切换到备选模型
              if (shouldFallback(error) || attempt >= MAX_RETRIES - 1) {
                break; // 跳出重试循环，尝试下一个模型
              }
            }
          }
        }

        // 所有尝试都失败
        if (!success) {
          if (process.env.NODE_ENV === 'development') {
            console.error("All plan generation attempts failed:", lastError);
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: lastError instanceof Error ? lastError.message : "生成失败，请稍后重试" })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "result", title: prompt.slice(0, 20), nodes: [], edges: [] })}\n\n`));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Plan API error:", e);
    }
    return new Response(
      JSON.stringify({ nodes: [], edges: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

