import type { AppNode, AppEdge, FlowContext, InputNodeData, ExecutionStatus, FlowState, OutputInputMappings } from "@/types/flow";
import { nanoid } from "nanoid";
import { NodeExecutorFactory } from "../executors/NodeExecutorFactory";
import { updateNodeStatus, resetAllNodesStatus } from "../utils/nodeStatusUtils";
import { hasCycle } from "../utils/cycleDetection";
import { calculateTopologicalLevels, groupNodesByLevel, getDescendants } from "../utils/parallelExecutionUtils";
import { resolveSourceNodeIdFromSource } from "../utils/sourceResolver";
import { showWarning } from "@/utils/errorNotify";
import { checkInputNodeMissing } from "../utils/inputValidation";


export const createExecutionActions = (
    set: (partial: ((state: FlowState) => Partial<FlowState>) | Partial<FlowState>) => void,
    get: () => FlowState
) => {
    // Helper: Execute a single node logic
    const executeSingleNode = async (
        nodeId: string,
        context: FlowContext,
        isDebugRunner: boolean = false,
        mockInputData?: Record<string, unknown>
    ): Promise<{ output: Record<string, unknown>; executionTime: number } | null> => {
        const { nodes, edges } = get();
        const node = nodes.find((n: AppNode) => n.id === nodeId);

        if (!node) throw new Error(`Node ${nodeId} not found during execution`);

        if (isDebugRunner && node.type === 'input' && !mockInputData) {
            return null;
        }

        set((state: FlowState) => ({
            nodes: updateNodeStatus(state.nodes, nodeId, "running")
        }));

        try {
            let upstreamContext: FlowContext = {};

            if (isDebugRunner && mockInputData) {
                upstreamContext = { mock: mockInputData };
            } else {
                upstreamContext = {
                    _meta: context._meta,
                };
                const incomingEdges = edges.filter((e: AppEdge) => e.target === nodeId);
                incomingEdges.forEach((edge: AppEdge) => {
                    const upstreamOutput = context[edge.source];
                    if (upstreamOutput) {
                        upstreamContext[edge.source] = upstreamOutput;
                    }
                });
            }

            const executor = NodeExecutorFactory.getExecutor(node.type);
            const { output, executionTime } = await executor.execute(node, upstreamContext);

            if (!get().nodes.find((n: AppNode) => n.id === nodeId)) {
                throw new Error("Node deleted during execution");
            }

            const outputObj = output as Record<string, unknown>;

            set((state: FlowState) => ({
                nodes: state.nodes.map((n: AppNode) => n.id === nodeId ? {
                    ...n,
                    data: {
                        ...n.data,
                        status: "completed",
                        executionTime: executionTime,
                        output: output,
                        // NOTE: Output node text is now only stored in flowContext
                        // to prevent double-write inconsistency issues
                    }
                } : n)
            }));

            return { output, executionTime };

        } catch (error) {
            // console.error(`Node ${nodeId} execution failed:`, error);
            if (get().nodes.find((n: AppNode) => n.id === nodeId)) {
                set((state: FlowState) => ({
                    nodes: updateNodeStatus(state.nodes, nodeId, "error")
                }));
            }
            throw error;
        }
    };

    return {
        /**
         * 重置执行状态
         * @param clearInputs 是否清除输入节点的用户数据
         */
        resetExecution: (clearInputs: boolean = false) => {
            set((state: FlowState) => ({
                executionStatus: "idle",
                executionError: null,
                flowContext: {},
                nodes: resetAllNodesStatus(state.nodes, clearInputs),
                // Reset streaming state
                streamingText: "",
                isStreaming: false,
                // 重置中断标志，确保新的流式输出可以正常工作
                // 这是必须的，因为 abortStreaming 会设置此标志为 true
                _streamingAborted: false,
                // Reset segment streaming state
                streamingMode: "single",
                streamingSegments: [],
                lockedSourceId: null,
                selectSourceIds: [],
            }));
        },

        /**
         * 执行整个 Flow
         * @param sessionId 可选的会话 ID，用于对话记忆功能。如果不传则生成新 ID。
         */

        runFlow: async (sessionId?: string) => {
            const { nodes, edges, resetExecution, currentFlowId } = get();

            // 1. 循环依赖检测（防止无限循环）
            for (const node of nodes) {
                if (hasCycle(node.id, nodes, edges)) {
                    set({
                        executionStatus: "error",
                        executionError: "检测到循环依赖，无法执行工作流。请检查节点连接。"
                    });
                    return;
                }
            }

            // 2. Check if input nodes have valid data or need user input
            const inputNodes = nodes.filter((n: AppNode) => n.type === 'input');
            const invokeInputPrompt = inputNodes.some((n: AppNode) => {
                return checkInputNodeMissing(n.data as InputNodeData);
            });

            if (invokeInputPrompt) {
                get().openInputPrompt();
                return;
            }

            // 3. 执行锁
            if (get()._executionLock) {
                showWarning("请等待", "流程正在执行中，请等待完成后再试");
                return;
            }
            set({ _executionLock: true });

            resetExecution();
            set({ executionStatus: "running", executionError: null });

            // 4. 初始化流式模式（基于 Output 节点配置）
            const outputNode = nodes.find((n: AppNode) => n.type === 'output');
            if (outputNode) {
                const inputMappings = (outputNode.data as { inputMappings?: OutputInputMappings })?.inputMappings;
                const mode = inputMappings?.mode || 'direct';
                const sources = inputMappings?.sources || [];

                if (mode === 'merge' && sources.length > 0) {
                    // merge 模式：初始化分段流式
                    const sourceNodeIds = sources
                        .map(s => resolveSourceNodeIdFromSource(s, nodes))
                        .filter((id): id is string => id !== null);

                    if (sourceNodeIds.length > 0) {
                        get().initSegmentedStreaming(sourceNodeIds);
                    }
                } else if (mode === 'select' && sources.length > 0) {
                    // select 模式：初始化首字锁定
                    const sourceNodeIds = sources
                        .map(s => resolveSourceNodeIdFromSource(s, nodes))
                        .filter((id): id is string => id !== null);

                    if (sourceNodeIds.length > 0) {
                        get().initSelectStreaming(sourceNodeIds);
                    }
                }
            }

            try {
                const effectiveSessionId = sessionId || nanoid(10);

                // 构建节点标签到 ID 的映射
                const nodeLabels: Record<string, string> = {};
                nodes.forEach((n: AppNode) => {
                    const label = (n.data?.label as string) || n.type || n.id;
                    nodeLabels[n.id] = label;
                });

                const context: FlowContext = {
                    _meta: {
                        flowId: currentFlowId,
                        sessionId: effectiveSessionId,
                        nodeLabels,
                    }
                };

                set({ flowContext: context });

                const initialNodeIds = new Set(nodes.map((n: AppNode) => n.id));
                // OPTIMIZATION: Create a map for O(1) node lookups
                // We use this for static node data (type, data fields) that doesn't change during execution
                // Execution status/output updates are handled via separate store updates
                const nodeMap = new Map<string, AppNode>(nodes.map((n: AppNode) => [n.id, n]));

                const checkFlowIntegrity = () => {
                    const currentNodes = get().nodes;
                    const currentIds = new Set(currentNodes.map((n: AppNode) => n.id));
                    for (const id of initialNodeIds) {
                        if (!currentIds.has(id)) {
                            throw new Error("Execution interrupted: Flow structure changed (node deleted).");
                        }
                    }
                };

                // ============ PARALLEL EXECUTION ENGINE ============

                // 计算拓扑层级
                const nodeLevels = calculateTopologicalLevels(nodes, edges);
                const levelGroups = groupNodesByLevel(nodes, nodeLevels);

                // 获取最大层级
                const maxLevel = Math.max(...Array.from(levelGroups.keys()));

                // 跟踪完成和阻塞的节点
                const completedNodes = new Set<string>();
                const blockedNodes = new Set<string>();
                const executionErrors: { nodeId: string; error: Error }[] = [];

                // 执行单个节点并处理分支逻辑
                const executeNodeAndHandleBranch = async (nodeId: string): Promise<void> => {
                    checkFlowIntegrity();

                    // 跳过被阻塞的节点
                    if (blockedNodes.has(nodeId)) {
                        return;
                    }

                    const result = await executeSingleNode(nodeId, context, false);

                    if (result) {
                        context[nodeId] = result.output;
                        set({ flowContext: { ...context } });
                    }

                    completedNodes.add(nodeId);

                    // 处理分支节点：阻塞未选中的路径
                    // PERFORMANCE: Use cached nodeMap for lookup
                    const node = nodeMap.get(nodeId);
                    if (node?.type === 'branch' && result) {
                        const branchOutput = result.output as Record<string, unknown>;
                        const conditionResult = !!branchOutput?.conditionResult;
                        const notTakenHandle = conditionResult ? 'false' : 'true';
                        const takenHandle = conditionResult ? 'true' : 'false';

                        // 获取未选中分支的所有下游节点
                        const notTakenDescendants = getDescendants(nodeId, edges, notTakenHandle);

                        // FIX: 获取选中分支可达的所有节点（这些节点不应被阻塞）
                        // 场景：当两条分支路径最终汇合到同一个下游节点时，
                        // 该节点不应该因为"未选中路径也能到达它"而被阻塞
                        const takenDescendants = getDescendants(nodeId, edges, takenHandle);

                        // 只阻塞那些【仅】从未选中路径可达的节点
                        notTakenDescendants.forEach(id => {
                            if (!takenDescendants.has(id)) {
                                blockedNodes.add(id);
                            }
                        });
                    }
                };

                // 按层级并行执行
                for (let level = 0; level <= maxLevel; level++) {
                    checkFlowIntegrity();

                    const nodesAtLevel = levelGroups.get(level) || [];

                    // 过滤：跳过被阻塞的节点
                    const executableNodes = nodesAtLevel.filter(id => !blockedNodes.has(id));

                    if (executableNodes.length === 0) continue;

                    // 并行执行当前层级的所有节点
                    const results = await Promise.allSettled(
                        executableNodes.map(nodeId => executeNodeAndHandleBranch(nodeId))
                    );

                    // 收集错误
                    results.forEach((result, index) => {
                        if (result.status === 'rejected') {
                            executionErrors.push({
                                nodeId: executableNodes[index],
                                error: result.reason instanceof Error ? result.reason : new Error(String(result.reason))
                            });
                        }
                    });

                    // 如果有错误，停止执行
                    if (executionErrors.length > 0) {
                        break;
                    }
                }

                // ============ END PARALLEL EXECUTION ============

                if (executionErrors.length > 0) {
                    const errorMessages = executionErrors.map(e => `${e.nodeId}: ${e.error.message}`).join('; ');
                    throw new Error(`节点执行失败: ${errorMessages}`);
                }

                set({ executionStatus: "completed" });
            } catch (error) {
                set({
                    executionStatus: "error" as ExecutionStatus,
                    executionError: error instanceof Error ? error.message : "Unknown error occurred"
                });
            } finally {
                set({ _executionLock: false });
            }
        },


        /**
         * 执行单个节点（仅开发调试用）
         */
        runNode: async (nodeId: string, mockInputData?: Record<string, unknown>) => {
            const node = get().nodes.find((n: AppNode) => n.id === nodeId);
            if (!node || !node.type) return;
            if (node.type === "input" && !mockInputData) return;

            // Track running node
            set((state: FlowState) => {
                const newRunningNodeIds = new Set(state.runningNodeIds);
                newRunningNodeIds.add(nodeId);
                return { runningNodeIds: newRunningNodeIds };
            });

            // Check if there are incoming connections
            const incomingEdges = get().edges.filter((e: AppEdge) => e.target === nodeId);
            if (incomingEdges.length > 0 && !mockInputData) {
                // For LLM nodes, open debug dialog
                if (node.type === 'llm') {
                    get().openLLMDebugDialog(nodeId);
                    return;
                }
                // For other nodes (RAG, Tool), we can still run directly
                // They will use upstream data from flowContext if available
            }

            const currentContext = get().flowContext || {};

            try {
                const result = await executeSingleNode(nodeId, currentContext, true, mockInputData);

                if (result) {
                    const prev = get().flowContext;
                    set({ flowContext: { ...prev, [nodeId]: result.output } });
                }
            } catch (error) {
                console.error(`Node ${nodeId} direct execution failed:`, error);
                throw error;
            } finally {
                // Remove from running nodes
                set((state: FlowState) => {
                    const newRunningNodeIds = new Set(state.runningNodeIds);
                    newRunningNodeIds.delete(nodeId);
                    return { runningNodeIds: newRunningNodeIds };
                });
            }
        },


    };
};
