import type { AppNode, AppEdge, LLMNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { llmMemoryService, type ConversationMessage } from "@/services/llmMemoryService";

import { LLM_EXECUTOR_CONFIG } from "../constants/executorConfig";
import { useFlowStore } from "@/store/flowStore";
import { useQuotaStore } from "@/store/quotaStore";
import { collectVariables } from "./utils/variableUtils";

/**
 * 检查 LLM 节点是否为用户交互节点
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

    // Quota check
    const quotaError = await this.checkQuota(effectiveMockData);
    if (quotaError) {
      return quotaError;
    }

    const { result, time } = await this.measureTime(async () => {
      await this.delay(LLM_EXECUTOR_CONFIG.DEFAULT_DELAY_MS);

      const llmData = node.data as LLMNodeData;
      let systemPrompt = llmData.systemPrompt || "";

      // 获取 flow store 状态
      const storeState = useFlowStore.getState();
      const { nodes: allNodes, edges: allEdges, flowContext: globalFlowContext } = storeState;

      const isUserFacingLLM = checkIsUserFacingLLM(node.id, allNodes, allEdges);

      // 1. 变量收集与 Prompt 替换
      if (effectiveMockData && Object.keys(effectiveMockData).length > 0) {
        // 调试模式
        const stringValues: Record<string, string> = {};
        Object.entries(effectiveMockData).forEach(([key, value]) => {
          stringValues[key] = String(value);
        });
        systemPrompt = replaceVariables(systemPrompt, stringValues);
      } else {
        // 正常模式
        const allVariables = collectVariables(context, globalFlowContext, allNodes);
        if (Object.keys(allVariables).length > 0) {
          systemPrompt = replaceVariables(systemPrompt, allVariables);
        }
      }

      // 2. 输入内容解析
      const inputContent = this.resolveInputContent(
        context,
        globalFlowContext,
        isUserFacingLLM,
        effectiveMockData
      );

      // 3. 对话记忆处理
      const flowId = (context._meta as Record<string, unknown>)?.flowId as string | undefined;
      const sessionId = (context._meta as Record<string, unknown>)?.sessionId as string | undefined;
      const memoryEnabled = llmData.enableMemory === true;
      const maxTurns = llmData.memoryMaxTurns ?? 10;
      const memoryNodeId = isUserFacingLLM ? "__main__" : node.id;

      let conversationHistory: ConversationMessage[] = [];
      if (memoryEnabled && flowId && sessionId) {
        conversationHistory = await this.fetchMemory(flowId, memoryNodeId, sessionId, maxTurns, inputContent);
      }

      // 4. 执行 LLM 请求
      try {
        const { appendStreamingText, clearStreaming, resetStreamingAbort } = storeState;
        const enableStreaming = isUserFacingLLM;

        if (enableStreaming) {
          resetStreamingAbort();
          clearStreaming();
        }

        const resp = await fetch("/api/run-node-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: llmData.model || LLM_EXECUTOR_CONFIG.DEFAULT_MODEL,
            systemPrompt,
            temperature: llmData.temperature ?? LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
            input: inputContent,
            conversationHistory: memoryEnabled ? conversationHistory : undefined,
          }),
        });

        if (!resp.ok) {
          throw new Error(`API request failed: ${resp.status}`);
        }

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No response body");

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
                  if (enableStreaming) {
                    appendStreamingText(parsed.content);
                    await new Promise(resolve => setTimeout(resolve, 30));
                  }
                }
                if (parsed.error) throw new Error(parsed.error);
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        // 5. 保存记忆
        if (memoryEnabled && flowId && sessionId && fullResponse) {
          this.saveMemory(flowId, memoryNodeId, sessionId, 'assistant', fullResponse, maxTurns);
        }

        // 6. 扣除额度
        if (!effectiveMockData || Object.keys(effectiveMockData).length === 0) {
          this.incrementQuota();
        }

        return { response: fullResponse };

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("LLM execution failed:", errorMessage);
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

  /**
   * 检查配额
   */
  private async checkQuota(effectiveMockData?: Record<string, unknown>): Promise<ExecutionResult | null> {
    if (!effectiveMockData || Object.keys(effectiveMockData).length === 0) {
      try {
        const user = await authService.getCurrentUser();
        if (!user) {
          return {
            output: { error: "请先登录以使用 LLM 功能" },
            executionTime: 0,
          };
        }

        const quotaCheck = await quotaService.checkQuota(user.id, "llm_executions");
        if (!quotaCheck.allowed) {
          return {
            output: { error: `LLM 执行次数已用完 (${quotaCheck.used}/${quotaCheck.limit})。请联系管理员增加配额。` },
            executionTime: 0,
          };
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("[LLMNodeExecutor] Quota check failed:", errorMsg);
        return {
          output: { error: "配额检查失败，请稍后重试或联系支持" },
          executionTime: 0,
        };
      }
    }
    return null;
  }

  /**
   * 解析输入内容
   * 必须通过 inputMappings.user_input 显式配置
   */
  private resolveInputContent(
    context: FlowContext,
    _globalFlowContext: FlowContext,
    _isUserFacingLLM: boolean,
    effectiveMockData?: Record<string, unknown>
  ): string {
    // 调试模式：使用第一个 mock 值
    if (effectiveMockData && Object.keys(effectiveMockData).length > 0) {
      const stringValues: Record<string, string> = {};
      Object.entries(effectiveMockData).forEach(([key, value]) => {
        stringValues[key] = String(value);
      });
      return Object.values(stringValues)[0] || "";
    }

    // 从上游 context 中获取 user_input（通过 inputMappings 配置）
    const upstreamEntries = Object.entries(context).filter(([key]) => !key.startsWith('_'));
    for (const [, data] of upstreamEntries) {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (typeof obj.user_input === 'string' && obj.user_input.trim()) {
          return obj.user_input;
        }
      }
    }

    return "";
  }

  /**
   * 获取并更新对话记忆
   */
  private async fetchMemory(
    flowId: string,
    memoryNodeId: string,
    sessionId: string,
    maxTurns: number,
    inputContent: string
  ): Promise<ConversationMessage[]> {
    try {
      const history = await llmMemoryService.getHistory(
        flowId,
        memoryNodeId,
        sessionId,
        maxTurns
      );

      await llmMemoryService.appendMessage(
        flowId,
        memoryNodeId,
        sessionId,
        'user',
        inputContent
      );

      return history;
    } catch (e) {
      console.error("[LLMNodeExecutor] Memory fetch failed:", e);
      return [];
    }
  }

  /**
   * 保存助手回复到记忆
   */
  private async saveMemory(
    flowId: string,
    memoryNodeId: string,
    sessionId: string,
    role: 'assistant',
    content: string,
    maxTurns: number
  ) {
    try {
      await llmMemoryService.appendMessage(
        flowId,
        memoryNodeId,
        sessionId,
        role,
        content
      );
      await llmMemoryService.trimHistory(flowId, memoryNodeId, sessionId, maxTurns);
    } catch (e) {
      console.error("[LLMNodeExecutor] Memory save failed:", e);
    }
  }

  /**
   * 扣除额度
   */
  private async incrementQuota() {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const updated = await quotaService.incrementUsage(user.id, "llm_executions");
        if (!updated) {
          console.warn("[LLMNodeExecutor] Failed to increment quota - quota service returned null");
        } else {
          const { refreshQuota } = useQuotaStore.getState();
          await refreshQuota(user.id);
        }
      } else {
        console.warn("[LLMNodeExecutor] Cannot increment quota - user not authenticated");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("[LLMNodeExecutor] Failed to increment quota:", errorMsg);
    }
  }
}
