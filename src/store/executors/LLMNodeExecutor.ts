import type { AppNode, AppEdge, LLMNodeData, FlowContext, FlowContextMeta, OutputInputMappings } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { llmMemoryService, type ConversationMessage } from "@/services/llmMemoryService";

import { LLM_EXECUTOR_CONFIG } from "../constants/executorConfig";
import { useFlowStore } from "@/store/flowStore";
import { useQuotaStore } from "@/store/quotaStore";
import { collectVariables } from "./utils/variableUtils";
import type { StreamingMode } from "../actions/streamingActions";
import { resolveSourceNodeId } from "../utils/sourceResolver";

/**
 * 流式输出配置
 */
interface StreamingConfig {
  shouldStream: boolean;
  streamMode: StreamingMode;
  outputNodeId: string | null;
}

/**
 * 查找下游 Output 节点
 */
function findDownstreamOutputNode(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  nodeMap?: Map<string, AppNode>
): AppNode | null {
  // 使用传入的 Map 或创建新的（避免重复创建）
  const map = nodeMap ?? new Map(nodes.map(n => [n.id, n]));

  // 检查直接连接
  const outgoingEdges = edges.filter(e => e.source === nodeId);
  for (const edge of outgoingEdges) {
    const targetNode = map.get(edge.target);
    if (targetNode?.type === 'output') return targetNode;
  }

  // 检查是否通过 branch 连接到 output
  const incomingEdges = edges.filter(e => e.target === nodeId);
  for (const inEdge of incomingEdges) {
    const sourceNode = map.get(inEdge.source);
    if (sourceNode?.type === 'branch') {
      // 如果上游是 branch，检查 branch 下游的所有 output 节点
      const branchOutgoing = edges.filter(e => e.source === sourceNode.id);
      for (const bEdge of branchOutgoing) {
        const bTarget = map.get(bEdge.target);
        if (bTarget?.type === 'output') return bTarget;
      }
    }
  }

  return null;
}

/**
 * 检查 LLM 节点是否为用户交互节点，并返回流式配置
 */
function getStreamingConfig(
  nodeId: string,
  nodes: AppNode[],
  edges: AppEdge[]
): StreamingConfig {
  const noStream: StreamingConfig = { shouldStream: false, streamMode: 'single', outputNodeId: null };

  // 检查是否存在 Output 节点
  const hasOutputNode = nodes.some(n => n.type === 'output');
  if (!hasOutputNode) return noStream;

  // 构建节点 Map，避免重复创建
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // 查找下游 Output 节点
  const outputNode = findDownstreamOutputNode(nodeId, nodes, edges, nodeMap);
  if (!outputNode) return noStream;

  // 获取 Output 节点的模式配置
  const inputMappings = (outputNode.data as { inputMappings?: OutputInputMappings })?.inputMappings;
  const mode = inputMappings?.mode || 'direct';
  const sources = inputMappings?.sources || [];

  // 获取配置的 source 节点 ID 列表
  const configuredSourceIds = sources
    .filter(s => s.type === 'variable')
    .map(s => resolveSourceNodeId(s.value, nodes))
    .filter((id): id is string => id !== null);

  // 根据模式决定流式策略
  switch (mode) {
    case 'template':
      // template 模式：禁用流式，等待所有数据就绪后一次性渲染
      return { shouldStream: false, streamMode: 'single', outputNodeId: outputNode.id };

    case 'merge':
      // merge 模式：分段流式（需要是配置的 source 之一）
      if (configuredSourceIds.length > 0 && !configuredSourceIds.includes(nodeId)) {
        return noStream; // 不是配置的 source，不流式
      }
      return { shouldStream: true, streamMode: 'segmented', outputNodeId: outputNode.id };

    case 'select':
      // select 模式：首字锁定流式（需要是配置的 source 之一）
      if (configuredSourceIds.length > 0 && !configuredSourceIds.includes(nodeId)) {
        return noStream; // 不是配置的 source，不流式
      }
      return { shouldStream: true, streamMode: 'select', outputNodeId: outputNode.id };

    case 'direct':
    default:
      // direct 模式：只允许第一个配置的 source 流式
      if (configuredSourceIds.length > 0) {
        // 只有配置的第一个 source 才流式
        if (nodeId !== configuredSourceIds[0]) {
          return noStream;
        }
      }
      return { shouldStream: true, streamMode: 'single', outputNodeId: outputNode.id };
  }
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

      // 获取流式配置（基于 Output 节点模式）
      const streamingConfig = getStreamingConfig(node.id, allNodes, allEdges);
      const { shouldStream, streamMode } = streamingConfig;

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
        effectiveMockData
      );

      // 3. 对话记忆处理
      const meta = context._meta as FlowContextMeta | undefined;
      const flowId = meta?.flowId;
      const sessionId = meta?.sessionId;
      const memoryEnabled = llmData.enableMemory === true;
      const maxTurns = llmData.memoryMaxTurns ?? 10;
      const memoryNodeId = shouldStream ? "__main__" : node.id;

      let conversationHistory: ConversationMessage[] = [];
      if (memoryEnabled && flowId && sessionId) {
        conversationHistory = await this.fetchMemory(flowId, memoryNodeId, sessionId, maxTurns, inputContent);
      }

      // 4. 执行 LLM 请求
      try {
        const {
          appendStreamingText,
          clearStreaming,
          resetStreamingAbort,
          appendToSegment,
          completeSegment,
          tryLockSource
        } = storeState;

        if (shouldStream) {
          resetStreamingAbort();

          // 根据流式模式初始化
          if (streamMode === 'single') {
            // 单一流式模式（direct 模式）
            const currentStreamingText = useFlowStore.getState().streamingText;
            if (!currentStreamingText) {
              clearStreaming();
            }
          }
          // segmented 和 select 模式不需要在这里初始化，由 executionActions 在开始时初始化
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
        let fullReasoning = "";

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

                // Handle reasoning
                if (parsed.reasoning) {
                  fullReasoning += String(parsed.reasoning);
                  // For now, we don't have a UI for streaming reasoning, 
                  // but we capture it for the final result.
                }

                if (parsed.content) {
                  const contentStr = String(parsed.content);
                  fullResponse += contentStr;

                  if (shouldStream) {
                    // 极致打字机效果：将内容拆分为字符逐个显示
                    const chars = Array.from(contentStr);
                    for (const char of chars) {
                      this.flushBuffer(char, streamMode, node.id, storeState);
                      // 这里的速度可以根据积压程度动态调整，避免 UI 大幅落后于 API
                      // 如果积压较多，缩短延迟甚至不延迟
                      const delay = chars.length > 50 ? 2 : 5;
                      await new Promise(resolve => setTimeout(resolve, delay));
                    }
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

        // 流式完成后的处理
        if (shouldStream && streamMode === 'segmented') {
          completeSegment(node.id);
        }

        // 5. 保存记忆
        if (memoryEnabled && flowId && sessionId && fullResponse) {
          this.saveMemory(flowId, memoryNodeId, sessionId, 'assistant', fullResponse, maxTurns);
        }

        // 6. 扣除额度
        if (!effectiveMockData || Object.keys(effectiveMockData).length === 0) {
          this.incrementQuota();
        }

        return {
          response: fullResponse,
          reasoning: fullReasoning
        };

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);

        if (shouldStream) {
          if (streamMode === 'segmented') {
            // merge 模式失败：标记所有段落为失败（全部失败策略）
            storeState.failSegment(node.id, errorMessage);
          } else {
            storeState.clearStreaming();
          }
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
      // Silently handled
    }
  }

  /**
   * 扣除额度
   */
  /**
   * 扣除额度
   */
  private async incrementQuota() {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const updated = await quotaService.incrementUsage(user.id, "llm_executions");
        if (!updated) {
          // Quota increment failed silently
        } else {
          const { refreshQuota } = useQuotaStore.getState();
          await refreshQuota(user.id);
        }
      } else {
        // User not authenticated - silently skip quota increment
      }
    } catch (e) {
      // Silently handled
    }
  }

  /**
   * 冲刷 buffer 到 store
   */
  private flushBuffer(
    buffer: string,
    streamMode: StreamingMode,
    nodeId: string,
    storeState: any
  ) {
    const { appendStreamingText, appendToSegment, tryLockSource } = storeState;

    switch (streamMode) {
      case "segmented":
        appendToSegment(nodeId, buffer);
        break;

      case "select":
        if (tryLockSource(nodeId)) {
          appendStreamingText(buffer);
        }
        break;

      case "single":
      default:
        appendStreamingText(buffer);
        break;
    }
  }
}
