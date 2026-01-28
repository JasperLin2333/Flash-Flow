import type { AppNode, AppEdge, LLMNodeData, FlowContext, FlowContextMeta, OutputInputMappings } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { llmMemoryService, type ConversationMessage } from "@/services/llmMemoryService";
import { llmModelsAPI } from "@/services/llmModelsAPI";

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
      // merge 模式：使用分段流式传输
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
    // Create and register AbortController for this node execution
    const controller = new AbortController();
    useFlowStore.setState((state) => {
      const newMap = new Map(state.nodeAbortControllers);
      newMap.set(node.id, controller);
      return { nodeAbortControllers: newMap };
    });

    try {
      // Merge mockData from argument and context
      const effectiveMockData = mockData || (context.mock as Record<string, unknown>);

      // Quota check - always check, including debug mode
      const quotaError = await this.checkQuota((node.data as LLMNodeData).model);
      if (quotaError) {
        return quotaError;
      }

      const { result, time } = await this.measureTime(async () => {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

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
          node,
          allNodes,
          globalFlowContext,
          effectiveMockData
        );

        // 3. 对话记忆处理
        const meta = context._meta as FlowContextMeta | undefined;
        const flowId = meta?.flowId;
        const sessionId = meta?.sessionId;
        const memoryEnabled = llmData.enableMemory === true;
        // FIELD MAPPING: memoryMaxTurns (NodeData) → maxTurns (internal/llmMemoryService)
        const maxTurns = llmData.memoryMaxTurns ?? 10;
        const memoryNodeId = this.resolveMemoryNodeId(llmData, node.id);

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
          }

          const maxRetries = LLM_EXECUTOR_CONFIG.DEFAULT_MAX_RETRIES ?? 0;
          const timeoutMs = LLM_EXECUTOR_CONFIG.DEFAULT_TIMEOUT_MS ?? 180000;

          let fullResponse = "";
          let fullReasoning = "";
          let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            // Reset buffers for this attempt
            fullResponse = "";
            fullReasoning = "";
            finalUsage = null;

            if (shouldStream && streamMode === 'single' && attempt > 0) {
               // On retry, clear previous partial streaming output
               storeState.clearStreaming();
            }

            // Create a controller for this specific attempt (combines user abort + timeout)
            const attemptController = new AbortController();
            const timeoutId = setTimeout(() => attemptController.abort(), timeoutMs);
            
            // Link user cancellation to this attempt
            const onUserAbort = () => attemptController.abort();
            if (controller.signal.aborted) {
                clearTimeout(timeoutId);
                throw new DOMException('Aborted', 'AbortError');
            }
            controller.signal.addEventListener('abort', onUserAbort);

            try {
                const resp = await fetch("/api/run-node-stream", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                    model: llmData.model || LLM_EXECUTOR_CONFIG.DEFAULT_MODEL,
                    systemPrompt,
                    temperature: llmData.temperature ?? LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
                    input: inputContent,
                    conversationHistory: memoryEnabled ? conversationHistory : undefined,
                    responseFormat: llmData.responseFormat,
                    }),
                    signal: attemptController.signal,
                });

                if (!resp.ok) {
                    throw new Error(`API request failed: ${resp.status}`);
                }

                const reader = resp.body?.getReader();
                if (!reader) throw new Error("No response body");

                const decoder = new TextDecoder();

                while (true) {
                    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

                    let readResult: ReadableStreamReadResult<Uint8Array>;
                    try {
                        readResult = await reader.read();
                    } catch (e: any) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        if (e?.name === 'AbortError' || errorMessage.includes('Aborted')) throw e;
                        throw new Error(`Stream read failed: ${errorMessage}`);
                    }

                    const { done, value } = readResult;
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") continue;

                            try {
                                const parsed = JSON.parse(data);

                                if (parsed.usage) finalUsage = parsed.usage;

                                if (parsed.reasoning) {
                                    const reasoningStr = String(parsed.reasoning);
                                    fullReasoning += reasoningStr;
                                    if (shouldStream) {
                                        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                                        storeState.appendStreamingReasoning(reasoningStr, node.id);
                                    }
                                }

                                if (parsed.content) {
                                    const contentStr = String(parsed.content);
                                    fullResponse += contentStr;

                                    if (shouldStream) {
                                        const chars = Array.from(contentStr);
                                        for (const char of chars) {
                                            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                                            this.flushBuffer(char, streamMode, node.id, storeState);
                                            // Dynamic delay based on backlog
                                            const delay = chars.length > 50 ? 2 : 5;
                                            await new Promise(resolve => setTimeout(resolve, delay));
                                        }
                                    }
                                }
                                if (parsed.error) throw new Error(parsed.error);
                            } catch (e: any) {
                                if (e.name === 'AbortError' || e.message === 'Aborted') throw e;
                                if (e instanceof SyntaxError) continue;
                                throw e;
                            }
                        }
                    }
                }
                
                // If we get here, success!
                break;

            } catch (error: any) {
                // If it's a user abort, rethrow immediately
                if (controller.signal.aborted || error.name === 'AbortError') {
                    // Check if it was actually a timeout (attempt aborted but user didn't)
                    if (!controller.signal.aborted && attemptController.signal.aborted) {
                        throw new Error(`Execution timed out after ${timeoutMs}ms`);
                    }
                    throw error;
                }

                // If last attempt, throw
                if (attempt === maxRetries) throw error;

                // Log and wait before retry
                console.warn(`LLM execution failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`, error);
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // Exponential backoff

            } finally {
                clearTimeout(timeoutId);
                controller.signal.removeEventListener('abort', onUserAbort);
            }
          }

          // 5. 保存记忆
          if (memoryEnabled && flowId && sessionId && fullResponse) {
            // Only save if not aborted (though typically unreachable if aborted throws)
            if (!controller.signal.aborted) {
              this.saveMemory(flowId, memoryNodeId, sessionId, 'assistant', fullResponse, maxTurns);
            }
          }

          // 6. 刷新额度 UI（服务端已扣减）
          if (!controller.signal.aborted) {
            this.incrementQuota();
          }

          // 7. JSON 自动探测与解析
          // 当 responseFormat 为 json_object 或响应内容看起来像 JSON 时，尝试解析
          let finalResponse: string | object = fullResponse;
          const trimmed = fullResponse.trim();
          const looksLikeJson =
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'));

          if (llmData.responseFormat === 'json_object' || looksLikeJson) {
            try {
              finalResponse = JSON.parse(trimmed);
            } catch {
              // 解析失败，保持为字符串（静默降级）
            }
          }

          return {
            response: finalResponse,
            reasoning: fullReasoning,
          };


        } catch (e: any) {
          const errorMessage = e instanceof Error ? e.message : String(e);

          if (e.name === 'AbortError' || errorMessage.includes('Aborted')) {
            if (shouldStream) {
              // Optionally clear or mark as interrupted, but typically we just stop appending
            }
            // Re-throw to be caught by outer catch or return specific abort result
            throw e;
          }

          if (shouldStream) {
            if (streamMode === 'segmented') {
              storeState.failSegment(node.id, errorMessage);
            } else if (streamMode === 'select') {
              // 只在当前节点持有锁时才中断流
              // 避免非竞争获胜的节点失败导致整体流中断
              const lockedId = storeState.lockedSourceId;
              if (lockedId === node.id) {
                storeState.abortStreaming();
              }
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

    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'Aborted') {
        return {
          output: { error: 'Execution aborted by user' },
          executionTime: 0
        };
      }
      throw e; // Re-throw other errors
    } finally {
      // Cleanup controller regardless of success or failure
      useFlowStore.setState((state) => {
        const newMap = new Map(state.nodeAbortControllers);
        newMap.delete(node.id);
        return { nodeAbortControllers: newMap };
      });
    }
  }

  /**
   * 检查配额（始终检查，包括调试模式）
   */
  private async checkQuota(modelId?: string): Promise<ExecutionResult | null> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return {
          output: { error: "请先登录以使用 LLM 功能" },
          executionTime: 0,
        };
      }

      const requiredPoints = await this.getRequiredPoints(modelId);
      const pointsCheck = await quotaService.checkPoints(user.id, requiredPoints);
      if (!pointsCheck.allowed) {
        return {
          output: { error: `积分不足，当前余额 ${pointsCheck.balance}，需要 ${pointsCheck.required}。请联系管理员增加积分。` },
          executionTime: 0,
        };
      }
    } catch (e) {
      return {
        output: { error: "积分检查失败，请稍后重试或联系支持" },
        executionTime: 0,
      };
    }
    return null;
  }

  private async getRequiredPoints(modelId?: string): Promise<number> {
    if (!modelId) {
      return quotaService.getLLMPointsCost(modelId);
    }

    const model = await llmModelsAPI.getModelByModelId(modelId);
    if (model && typeof model.points_cost === "number") {
      return model.points_cost;
    }

    return quotaService.getLLMPointsCost(modelId);
  }

  /**
   * 解析输入内容
   * 支持通过 inputMappings.user_input 配置变量引用（如 {{输入.formData.用户输入}}）
   */
  private resolveInputContent(
    context: FlowContext,
    node: AppNode,
    allNodes: AppNode[],
    globalFlowContext: FlowContext,
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

    // 1. 优先从 inputMappings.user_input 解析变量引用
    const llmData = node.data as LLMNodeData;
    const inputMappings = (llmData as Record<string, unknown>).inputMappings as Record<string, string> | undefined;
    const userInputTemplate = inputMappings?.user_input;

    if (userInputTemplate) {
      // 收集所有可用变量并进行替换
      const allVariables = collectVariables(context, globalFlowContext, allNodes);
      return replaceVariables(userInputTemplate, allVariables);
    }

    // 2. Fallback removed: Strict strict adherence to inputMappings is now enforced.
    // If inputMappings.user_input is not set, we return empty string.
    return "";

  }

  /**
   * 获取记忆存储的 nodeId（每个节点独立记忆）
   */
  private resolveMemoryNodeId(_llmData: LLMNodeData, actualNodeId: string): string {
    // 简化设计：每个 LLM 节点独立维护自己的记忆
    return actualNodeId;
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
   * 刷新额度 UI（服务端已经扣减，这里只刷新显示）
   * PERF FIX: Server-side already incremented quota in /api/run-node-stream
   * This eliminates cross-border Supabase PATCH that caused 406 PGRST116 conflicts
   */
  private async incrementQuota() {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        // Only refresh the UI to reflect server-side quota update
        const { refreshQuota } = useQuotaStore.getState();
        await refreshQuota(user.id);
      }
    } catch (e) {
      // Quota UI refresh failed - non-critical
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
      case "select":
        if (tryLockSource(nodeId)) {
          appendStreamingText(buffer);
        }
        break;

      case "segmented":
        appendToSegment(nodeId, buffer);
        break;

      case "single":
      default:
        appendStreamingText(buffer);
        break;
    }
  }
}
