import OpenAI from "openai";
export const runtime = 'edge';
import { PlanRequestSchema } from "@/utils/validation";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkQuotaOnServer, incrementQuotaOnServer, quotaExceededResponse } from "@/lib/quotaEdge";
import { CORE_RULES, PLAN_PROMPT, NODE_REFERENCE, VARIABLE_RULES, EDGE_RULES, FLOW_EXAMPLES, NEGATIVE_EXAMPLES } from "@/lib/prompts";
import { WorkflowZodSchema } from "@/lib/schemas/workflow";
import { extractBalancedJson, validateWorkflow } from "@/lib/agent/utils";

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


    const system = `${PLAN_PROMPT}

${CORE_RULES}

${NODE_REFERENCE}

${VARIABLE_RULES}

${EDGE_RULES}

${FLOW_EXAMPLES}

${NEGATIVE_EXAMPLES}
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
                response_format: { type: "json_object" },
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
              const extractedJson = extractBalancedJson(fullContent);
              if (extractedJson) jsonText = extractedJson;

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

              // 检查逻辑有效性 (使用共享校验逻辑)
              const validation = validateWorkflow(nodes, edges);

              if (!validation.valid && !validation.softPass) {
                lastError = new Error(`Validation failed: ${validation.errors.join("; ")}`);
                if (attempt < MAX_RETRIES - 1) {
                  continue; // 重试
                }
                break; // 切换模型
              }

              // Use healed nodes if available
              const finalNodes = validation.fixedNodes || nodes;

              if (validation.warnings && validation.warnings.length > 0) {
                if (process.env.NODE_ENV === 'development') {
                  console.log("[QuickMode] Auto-healed variables:", validation.warnings);
                }
              }

              // 成功！发送结果
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "result", title, nodes: finalNodes, edges })}\n\n`));
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

