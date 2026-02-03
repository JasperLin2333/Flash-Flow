import OpenAI from "openai";
export const runtime = 'edge';
import { PlanRequestSchema } from "@/utils/validation";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from "@/lib/quotaEdge";
import { CORE_RULES, PLAN_PROMPT, NODE_REFERENCE, VARIABLE_RULES, EDGE_RULES, FULL_EXAMPLES } from "@/lib/prompts";
import { extractBalancedJson, validateWorkflow } from "@/lib/agent/utils";
import { ensureInputOutputNodesAndEdges } from "@/lib/flowUtils";
import { validateGeneratedWorkflowV1_2 } from "@/lib/agent/generatedWorkflowValidatorV1";
import { deterministicFixWorkflowV1 } from "@/lib/agent/deterministicFixerV1";

// ============ 兜底策略配置 ============
const FALLBACK_MODEL = "gemini-3-pro-preview"; // 备选模型 (视觉+文本)
const OFFICIAL_MODEL = "deepseek-chat"; // 官方 DeepSeek 降级
const MAX_RETRIES = 2; // 每个模型最大重试次数
const RETRY_DELAY_MS = 1000; // 重试延迟
const TIMEOUT_GENERATION_MS = 60000;

/** 延迟函数 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 判断是否应该重试（可恢复性错误） */
function shouldRetry(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  // 超时、速率限制、服务暂时不可用、JSON解析失败 → 重试
  return msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("json") ||
    msg.includes("parse");
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

    const pointsCheck = await checkPointsOnServer(req, user.id, "flow_generation");
    if (!pointsCheck.allowed) {
      return pointsExceededResponse(pointsCheck.balance, pointsCheck.required);
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
    const { prompt, skipAutomatedValidation } = parseResult.data;
    const shouldSkipAutomatedValidation = skipAutomatedValidation === true;

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
    const preferredModel = process.env.DEFAULT_LLM_MODEL || "deepseek-v3.2";

    // Import shared prompt modules
    // Note: Constants are imported from '@/lib/prompts' at the top of the file


    const system = `${PLAN_PROMPT}

${CORE_RULES}

${NODE_REFERENCE}

${VARIABLE_RULES}

${EDGE_RULES}

${FULL_EXAMPLES}
`;

    const userMsg = [
      `用户描述: ${prompt}`,
      files.length ? `可用知识库文件: ${files.map(f => f.name).join(", ")}` : "无可用知识库文件",
    ].join("\n");

    // Create streaming response to avoid timeout
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const modelsToTry = [preferredModel, OFFICIAL_MODEL, FALLBACK_MODEL];
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

              const abortController = new AbortController();
              let timeoutId: ReturnType<typeof setTimeout> | null = null;
              let fullContent = "";
              try {
                timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_GENERATION_MS);
                const completion = await client.chat.completions.create({
                  model: currentModel,
                  temperature: 0.2,
                  messages: [
                    { role: "system", content: system },
                    { role: "user", content: userMsg },
                  ],
                  stream: true,
                  response_format: { type: "json_object" },
                }, { signal: abortController.signal });

                for await (const chunk of completion) {
                  const content = chunk.choices?.[0]?.delta?.content || "";
                  if (content) {
                    fullContent += content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "progress", content })}\n\n`));
                  }
                }
              } finally {
                if (timeoutId) clearTimeout(timeoutId);
              }

              // Parse the complete response
              let jsonText = fullContent;
              const extractedJson = extractBalancedJson(fullContent);
              if (extractedJson) jsonText = extractedJson;

              let plan: { title?: string; nodes?: unknown; edges?: unknown } = {};
              try {
                plan = JSON.parse(jsonText) as { title?: string; nodes?: unknown; edges?: unknown };
              } catch {
                // JSON 解析失败，可能需要重试
                lastError = new Error("Failed to parse LLM response as JSON");
                if (shouldRetry(lastError) && attempt < MAX_RETRIES - 1) {
                  continue; // 重试当前模型
                }
                // 切换到下一个模型
                break;
              }

              const title = plan?.title || prompt.slice(0, 20);
              let nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
              let edges = Array.isArray(plan?.edges) ? plan.edges : [];
              let finalNodes = nodes;

              const reportBefore = validateGeneratedWorkflowV1_2(nodes, edges);
              const enableReport = process.env.FLOW_VALIDATION_REPORT_ENABLED === "true";
              const enableSafeFix = process.env.FLOW_VALIDATION_SAFE_FIX_ENABLED === "true";
              if (enableReport && reportBefore.hardErrors.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "validation", hardErrors: reportBefore.hardErrors, warnings: reportBefore.warnings })}\n\n`));
              }

              if (enableSafeFix && reportBefore.hardErrors.length > 0) {
                const includeIoInDeterministicFix = process.env.FLOW_DETERMINISTIC_FIX_INCLUDE_IO === "true";
                const fixResult = deterministicFixWorkflowV1(nodes, edges, {
                  includeInputOutput: includeIoInDeterministicFix,
                  safeFixOptions: {
                    removeInvalidEdges: process.env.FLOW_SAFE_FIX_REMOVE_INVALID_EDGES !== "false",
                    dedupeEdges: process.env.FLOW_SAFE_FIX_DEDUPE_EDGES !== "false",
                    ensureEdgeIds: process.env.FLOW_SAFE_FIX_ENSURE_EDGE_IDS !== "false",
                    replaceVariableIdPrefixToLabel: process.env.FLOW_SAFE_FIX_ID_TO_LABEL !== "false",
                  }
                });
                const reportAfter = validateGeneratedWorkflowV1_2(fixResult.nodes, fixResult.edges);
                if (reportAfter.hardErrors.length < reportBefore.hardErrors.length) {
                  nodes = fixResult.nodes;
                  edges = fixResult.edges;
                  finalNodes = nodes;
                  if (enableReport) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "validation_fix", fixes: fixResult.fixes, before: reportBefore.hardErrors.length, after: reportAfter.hardErrors.length })}\n\n`));
                  }
                } else if (enableReport && fixResult.fixes.length > 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "validation_fix", fixes: [], before: reportBefore.hardErrors.length, after: reportAfter.hardErrors.length, skipped: true })}\n\n`));
                }
              }

              if (!shouldSkipAutomatedValidation) {
                const ensured = ensureInputOutputNodesAndEdges(nodes, edges);
                nodes = ensured.nodes;
                edges = ensured.edges;

                const validation = validateWorkflow(nodes, edges);
                finalNodes = validation.fixedNodes || nodes;
                edges = validation.fixedEdges || edges;
              }

              // 成功！发送结果
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "result", title, nodes: finalNodes, edges })}\n\n`));
              await deductPointsOnServer(req, user.id, "flow_generation", null, "Flow 生成");
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
