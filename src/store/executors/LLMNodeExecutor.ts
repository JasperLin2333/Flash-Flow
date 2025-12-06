import type { AppNode, AppEdge, LLMNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { llmMemoryService, type ConversationMessage } from "@/services/llmMemoryService";
import { extractInputFromContext } from "./contextUtils";
import { LLM_EXECUTOR_CONFIG } from "../constants/executorConfig";
import { useFlowStore } from "@/store/flowStore";
import { useQuotaStore } from "@/store/quotaStore";

/**
 * 检查 LLM 节点是否为用户交互节点
 * 
 * 用户交互 LLM 的判断标准:
 * 1. 直接连接到 output 节点
 * 2. 从 branch 节点接收输入（多路分支后的处理节点）
 * 
 * @param nodeId - 当前 LLM 节点的 ID
 * @param nodes - 所有节点
 * @param edges - 所有边
 * @returns 是否为用户交互 LLM
 */
function checkIsUserFacingLLM(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[]
): boolean {
  // 检查是否直接连接到 output
  const outgoingEdges = edges.filter(e => e.source === nodeId);
  for (const edge of outgoingEdges) {
    const targetNode = nodes.find(n => n.id === edge.target);
    if (targetNode?.type === 'output') return true;
  }

  // 检查是否在 branch 之后（从 branch 接收输入）
  const incomingEdges = edges.filter(e => e.target === nodeId);
  for (const inEdge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === inEdge.source);
    if (sourceNode?.type === 'branch') return true;
  }

  return false;
}

/**
 * LLM 节点执行器
 * 负责执行 LLM 节点，支持正常模式、调试模式和对话记忆
 */
export class LLMNodeExecutor extends BaseNodeExecutor {
  async execute(
    node: AppNode,
    context: FlowContext,
    mockData?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    // Merge mockData from argument and context
    const effectiveMockData = mockData || (context.mock as Record<string, unknown>);

    // Quota check: Only in production mode (skip in debug mode with mockData)
    if (!effectiveMockData || Object.keys(effectiveMockData).length === 0) {
      try {
        const user = await authService.getCurrentUser();

        // If user is not authenticated, return error immediately
        if (!user) {
          return {
            output: {
              error: "请先登录以使用 LLM 功能",
            },
            executionTime: 0,
          };
        }

        // Check quota availability
        const quotaCheck = await quotaService.checkQuota(user.id, "llm_executions");
        if (!quotaCheck.allowed) {
          return {
            output: {
              error: `LLM 执行次数已用完 (${quotaCheck.used}/${quotaCheck.limit})。请联系管理员增加配额。`,
            },
            executionTime: 0,
          };
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("[LLMNodeExecutor] Quota check failed:", errorMsg);
        // SECURITY FIX: Fail fast instead of degraded mode
        return {
          output: {
            error: "配额检查失败，请稍后重试或联系支持",
          },
          executionTime: 0,
        };
      }
    }

    const { result, time } = await this.measureTime(async () => {
      await this.delay(LLM_EXECUTOR_CONFIG.DEFAULT_DELAY_MS);

      const llmData = node.data as LLMNodeData;
      let systemPrompt = llmData.systemPrompt || "";
      let inputContent: string;

      // 获取 flow store 状态（提升到外层作用域以便后续复用）
      const storeState = useFlowStore.getState();
      const { nodes: allNodes, edges: allEdges, flowContext: globalFlowContext } = storeState;

      // REFACTOR: 只计算一次 isUserFacingLLM，避免重复代码
      const isUserFacingLLM = checkIsUserFacingLLM(node.id, allNodes, allEdges);

      // 调试模式：使用 mock 数据替换变量
      if (effectiveMockData && Object.keys(effectiveMockData).length > 0) {
        // 将 mockData 的值转换为字符串
        const stringValues: Record<string, string> = {};
        Object.entries(effectiveMockData).forEach(([key, value]) => {
          stringValues[key] = String(value);
        });

        // 替换 systemPrompt 中的变量
        systemPrompt = replaceVariables(systemPrompt, stringValues);

        // 输入内容使用第一个 mock 值或空字符串
        inputContent = Object.values(stringValues)[0] || "";
      } else {
        // 对于用户交互 LLM，从全局 flowContext 中获取 Input 节点的原始输入
        if (isUserFacingLLM) {
          // FIX: 优先从直接上游 context 中查找 Input 节点数据
          const upstreamInputEntry = Object.entries(context)
            .filter(([key]) => !key.startsWith('_'))
            .find(([key]) => key.startsWith('input'));

          if (upstreamInputEntry) {
            // 使用直接上游的 Input 节点数据
            const inputNodeData = upstreamInputEntry[1] as Record<string, unknown>;
            inputContent = String(inputNodeData?.user_input || inputNodeData?.text || "");
          } else {
            // 兜底：从全局 flowContext 中找到 Input 节点的数据
            const inputNodeId = Object.keys(globalFlowContext).find(key =>
              !key.startsWith('_') && key.startsWith('input')
            );

            if (inputNodeId) {
              const inputNodeData = globalFlowContext[inputNodeId] as Record<string, unknown>;
              inputContent = String(inputNodeData?.user_input || inputNodeData?.text || "");
            } else {
              // 最后兜底：尝试从全局 flowContext 中找到 user_input
              const entries = Object.entries(globalFlowContext).filter(([k]) => !k.startsWith('_'));
              let foundInput = "";
              for (const [, data] of entries) {
                if (data && typeof data === 'object' && 'user_input' in (data as object)) {
                  foundInput = String((data as Record<string, unknown>).user_input || "");
                  break;
                }
              }
              inputContent = foundInput || extractInputFromContext(context, "Start");
            }
          }
        } else {
          // 普通模式：使用共享工具函数从上游节点提取输入
          inputContent = extractInputFromContext(context, "Start");
        }
      }

      // ========== 对话记忆功能 ==========
      let conversationHistory: ConversationMessage[] = [];
      const memoryEnabled = llmData.enableMemory === true;
      const maxTurns = llmData.memoryMaxTurns ?? 10;

      // 从 context 中提取 flowId 和 sessionId
      const flowId = (context._meta as Record<string, unknown>)?.flowId as string | undefined;
      const sessionId = (context._meta as Record<string, unknown>)?.sessionId as string | undefined;

      // REFACTOR: 重用之前计算的 isUserFacingLLM，避免重复导入和计算
      // 用户交互 LLM 使用共享键 "__main__"，中间处理 LLM 使用自己的 node.id
      const memoryNodeId = isUserFacingLLM ? "__main__" : node.id;

      if (memoryEnabled && flowId && sessionId) {
        try {
          // 获取历史对话
          conversationHistory = await llmMemoryService.getHistory(
            flowId,
            memoryNodeId,
            sessionId,
            maxTurns
          );

          // 保存当前用户输入到记忆
          await llmMemoryService.appendMessage(
            flowId,
            memoryNodeId,
            sessionId,
            'user',
            inputContent
          );
        } catch (e) {
          console.error("[LLMNodeExecutor] Memory fetch failed:", e);
          // 记忆获取失败不影响主流程
        }
      }

      try {
        // 重用之前获取的 store state
        const { appendStreamingText, clearStreaming } = storeState;

        // REFACTOR: 重用之前计算的 isUserFacingLLM 判断是否需要流式输出
        // 只有用户交互 LLM 才需要流式输出
        const enableStreaming = isUserFacingLLM;

        // Clear previous streaming state only if we're going to stream
        if (enableStreaming) {
          // Reset abort flag first (in case previous streaming was aborted)
          storeState.resetStreamingAbort();
          clearStreaming();
        }

        // Use streaming API endpoint
        const resp = await fetch("/api/run-node-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: llmData.model || LLM_EXECUTOR_CONFIG.DEFAULT_MODEL,
            systemPrompt,
            temperature: llmData.temperature ?? LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
            input: inputContent,
            // 传入对话历史
            conversationHistory: memoryEnabled ? conversationHistory : undefined,
          }),
        });

        if (!resp.ok) {
          throw new Error(`API request failed: ${resp.status}`);
        }

        // Handle streaming response
        const reader = resp.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullResponse += parsed.content;
                  // Only update streaming state for LLM nodes connected to output
                  if (enableStreaming) {
                    appendStreamingText(parsed.content);
                    // Add small delay to slow down streaming for better UX
                    await new Promise(resolve => setTimeout(resolve, 30));
                  }
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // Skip malformed JSON chunks
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        // NOTE: We do NOT clear streaming here for success case.
        // The UI components (AppModeOverlay/useFlowChat) will clear it
        // after they have successfully added the final message to their local state.
        // This prevents the "flash" effect where content disappears before reappearing.

        const responseText = fullResponse;

        // 保存 assistant 回复到记忆
        if (memoryEnabled && flowId && sessionId && responseText) {
          try {
            await llmMemoryService.appendMessage(
              flowId,
              memoryNodeId,
              sessionId,
              'assistant',
              responseText
            );

            // 修剪超出轮数限制的历史
            await llmMemoryService.trimHistory(flowId, memoryNodeId, sessionId, maxTurns);
          } catch (e) {
            console.error("[LLMNodeExecutor] Memory save failed:", e);
          }
        }

        // Increment usage quota after successful execution (only in production mode)
        if (!effectiveMockData || Object.keys(effectiveMockData).length === 0) {
          try {
            const user = await authService.getCurrentUser();
            if (user) {
              const updated = await quotaService.incrementUsage(user.id, "llm_executions");
              if (!updated) {
                console.warn("[LLMNodeExecutor] Failed to increment quota - quota service returned null");
              } else {
                // 🧹 REFACTOR: Auto-refresh quota in UI for immediate feedback
                const { refreshQuota } = useQuotaStore.getState();
                await refreshQuota(user.id);
              }
            } else {
              console.warn("[LLMNodeExecutor] Cannot increment quota - user not authenticated");
            }
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error("[LLMNodeExecutor] Failed to increment quota:", errorMsg);
            // DEFENSIVE: We don't fail the request here since execution was successful
          }
        }

        return { response: responseText };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("LLM execution failed:", errorMessage);
        // FIX: 执行失败时清理流式输出状态
        if (isUserFacingLLM) {
          storeState.clearStreaming();
        }
        return { error: errorMessage };
      }
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
