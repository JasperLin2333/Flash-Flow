import type { AppNode, AppEdge, FlowContext, InputNodeData, ExecutionStatus, FlowState, OutputInputMappings } from "@/types/flow";
import { nanoid } from "nanoid";
import { NodeExecutorFactory } from "../executors/NodeExecutorFactory";
import { updateNodeStatus, resetAllNodesStatus } from "../utils/nodeStatusUtils";
import { hasCycle } from "../utils/cycleDetection";
import { getDescendants } from "../utils/parallelExecutionUtils";
import { resolveSourceNodeIdFromSource } from "../utils/sourceResolver";
import { showWarning } from "@/utils/errorNotify";
import { checkInputNodeMissing } from "../utils/inputValidation";
import { trackWorkflowRun, trackWorkflowRunSuccess, trackWorkflowRunFail } from "@/lib/trackingService";
import { ensureBranchHandlesForNode } from "@/lib/branchHandleUtils";


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
                const meta =
                    context._meta ??
                    (() => {
                        const nodeLabels: Record<string, string> = {};
                        nodes.forEach((n: AppNode) => {
                            const label = (n.data?.label as string) || n.type || n.id;
                            nodeLabels[n.id] = label;
                        });
                        return {
                            flowId: get().currentFlowId,
                            sessionId: nanoid(10),
                            nodeLabels,
                        };
                    })();
                upstreamContext = { _meta: meta, mock: mockInputData };
            } else {
                upstreamContext = {
                    _meta: context._meta,
                };
                const incomingEdges = edges.filter((e: AppEdge) => e.target === nodeId);
                incomingEdges.forEach((edge: AppEdge) => {
                    const upstreamOutput = context[edge.source];

                    // VALIDATION: Warn if upstream node returned no data (potential logic error)
                    if (upstreamOutput === undefined) {
                        console.warn(`[Execution] Warning: Upstream node ${edge.source} returned undefined output for node ${nodeId}`);
                    }

                    if (upstreamOutput !== undefined) {
                        upstreamContext[edge.source] = upstreamOutput;
                    }
                });
            }

            const executor = NodeExecutorFactory.getExecutor(node.type);

            // TIMEOUT: Add 5-minute timeout to prevent infinite hangs
            const NODE_EXECUTION_TIMEOUT = 300000; // 5 minutes
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Nodes execution timed out (${NODE_EXECUTION_TIMEOUT / 1000}s limit)`)), NODE_EXECUTION_TIMEOUT)
            );

            // Execute with race condition against timeout
            const resultRaw = await Promise.race([
                executor.execute(node, upstreamContext, mockInputData),
                timeoutPromise
            ]) as { output: Record<string, unknown>; executionTime: number };

            const { output, executionTime } = resultRaw;

            if (!get().nodes.find((n: AppNode) => n.id === nodeId)) {
                throw new Error("Node deleted during execution");
            }

            const outputError = (output as Record<string, unknown> | undefined)?.error;
            const hasOutputError =
                (typeof outputError === "string" && outputError.trim().length > 0) ||
                (outputError instanceof Error);

            set((state: FlowState) => ({
                nodes: state.nodes.map((n: AppNode) => n.id === nodeId ? {
                    ...n,
                    data: {
                        ...n.data,
                        status: hasOutputError ? "error" : "completed",
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
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : typeof error === "string"
                            ? error
                            : "节点执行失败";
                set((state: FlowState) => ({
                    nodes: updateNodeStatus(state.nodes, nodeId, "error", {
                        output: { error: errorMessage }
                    })
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

            // TRACKING: Start
            const startTime = Date.now();
            trackWorkflowRun(nodes.length, edges.length);

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

            // 跟踪节点状态（为了在 catch 中访问）
            const executionErrors: { nodeId: string; error: Error }[] = [];

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

                // ============ DEPENDENCY-DRIVEN PARALLEL EXECUTION ENGINE ============
                // 节点在其所有上游依赖完成后立即启动，无需等待同层级其他节点

                // 跟踪节点状态
                const completedNodes = new Set<string>();
                const blockedNodes = new Set<string>();
                const runningNodes = new Set<string>();
                // executionErrors defined outside try block

                // 为每个节点创建一个 Promise resolver，用于通知下游节点
                const nodeResolvers = new Map<string, () => void>();
                const nodePromises = new Map<string, Promise<void>>();

                // 初始化：为每个节点创建 Promise
                nodes.forEach((node: AppNode) => {
                    let resolver: () => void;
                    const promise = new Promise<void>((resolve) => {
                        resolver = resolve;
                    });
                    nodeResolvers.set(node.id, resolver!);
                    nodePromises.set(node.id, promise);
                });

                // 检查节点是否可以执行（所有上游完成或被阻塞）
                const canExecute = (nodeId: string): boolean => {
                    if (blockedNodes.has(nodeId) || completedNodes.has(nodeId) || runningNodes.has(nodeId)) {
                        return false;
                    }
                    const incomingEdges = edges.filter((e: AppEdge) => e.target === nodeId);
                    if (incomingEdges.length === 0) return true;

                    for (const edge of incomingEdges) {
                        if (!completedNodes.has(edge.source) && !blockedNodes.has(edge.source)) {
                            return false;
                        }
                    }
                    return true;
                };

                // 获取节点的直接下游节点
                const getDirectDownstream = (nodeId: string): string[] => {
                    return edges
                        .filter((e: AppEdge) => e.source === nodeId)
                        .map((e: AppEdge) => e.target);
                };

                // 执行单个节点并触发下游
                const executeNodeAndTriggerDownstream = async (nodeId: string): Promise<void> => {
                    checkFlowIntegrity();

                    // 跳过被阻塞的节点
                    if (blockedNodes.has(nodeId)) {
                        nodeResolvers.get(nodeId)?.();
                        return;
                    }

                    runningNodes.add(nodeId);

                    try {
                        const result = await executeSingleNode(nodeId, context, false);

                        if (result) {
                            context[nodeId] = result.output;
                            set((state) => ({
                                flowContext: {
                                    ...state.flowContext,
                                    [nodeId]: result.output
                                }
                            }));
                        }

                        completedNodes.add(nodeId);
                        runningNodes.delete(nodeId);

                        // 处理分支节点：阻塞未选中的路径
                        const node = nodeMap.get(nodeId);
                        if (node?.type === 'branch' && result) {
                            const branchOutput = result.output as Record<string, unknown>;
                            const conditionResult = !!branchOutput?.conditionResult;
                            const notTakenHandle = conditionResult ? 'false' : 'true';
                            const takenHandle = conditionResult ? 'true' : 'false';

                            const branchNodeId = nodeId;
                            const ensured = ensureBranchHandlesForNode(nodes as AppNode[], edges as AppEdge[], branchNodeId);
                            const edgesForBranch = ensured.edges as AppEdge[];
                            const notTakenDescendants = getDescendants(branchNodeId, edgesForBranch, notTakenHandle);
                            const takenDescendants = getDescendants(nodeId, edgesForBranch, takenHandle);

                            const outgoing = edgesForBranch.filter(e => e.source === branchNodeId);
                            if (outgoing.length > 0 && (notTakenDescendants.size === 0 || takenDescendants.size === 0)) {
                                showWarning("分支连线缺少 TRUE/FALSE 标记，可能导致路径选择异常");
                            }

                            for (const id of notTakenDescendants) {
                                if (takenDescendants.has(id)) {
                                    continue;
                                }
                                const incomingEdges = edges.filter((e: AppEdge) => e.target === id);
                                const hasExternalUpstream = incomingEdges.some(edge =>
                                    edge.source !== branchNodeId && !notTakenDescendants.has(edge.source)
                                );
                                if (hasExternalUpstream || completedNodes.has(id) || runningNodes.has(id)) {
                                    continue;
                                }
                                blockedNodes.add(id);
                                
                                // Explicitly mark as skipped in context so downstream knows it was skipped
                                const skippedOutput = { _skipped: true, _reason: 'branch_not_taken' };
                                context[id] = skippedOutput;
                                set((state) => ({
                                    flowContext: {
                                        ...state.flowContext,
                                        [id]: skippedOutput
                                    }
                                }));

                                nodeResolvers.get(id)?.();

                                const downstream = getDirectDownstream(id);
                                const executableDownstream = downstream.filter(downstreamId => canExecute(downstreamId));
                                if (executableDownstream.length > 0) {
                                    await Promise.allSettled(
                                        executableDownstream.map(downstreamId => executeNodeAndTriggerDownstream(downstreamId))
                                    );
                                }
                            }
                        }

                        // 通知当前节点已完成
                        nodeResolvers.get(nodeId)?.();

                        // 检查并启动可执行的下游节点
                        const downstream = getDirectDownstream(nodeId);
                        const executableDownstream = downstream.filter(id => canExecute(id));

                        if (executableDownstream.length > 0) {
                            await Promise.allSettled(
                                executableDownstream.map(id => executeNodeAndTriggerDownstream(id))
                            );
                        }
                    } catch (error) {
                        runningNodes.delete(nodeId);
                        executionErrors.push({
                            nodeId,
                            error: error instanceof Error ? error : new Error(String(error))
                        });
                        // 仍然需要 resolve 以免其他节点无限等待
                        nodeResolvers.get(nodeId)?.();
                        throw error;
                    }
                };

                // 找出所有入口节点（无上游依赖）并立即启动
                const entryNodes = nodes.filter((n: AppNode) => {
                    const incoming = edges.filter((e: AppEdge) => e.target === n.id);
                    return incoming.length === 0;
                });

                // 并行启动所有入口节点
                await Promise.allSettled(
                    entryNodes.map((n: AppNode) => executeNodeAndTriggerDownstream(n.id))
                );

                // ============ END PARALLEL EXECUTION ============

                if (executionErrors.length > 0) {
                    const errorMessages = executionErrors.map(e => `${e.nodeId}: ${e.error.message}`).join('; ');
                    throw new Error(`节点执行失败: ${errorMessages}`);
                }

                set({ executionStatus: "completed" });
                
                // TRACKING: Success
                trackWorkflowRunSuccess(Date.now() - startTime);

            } catch (error) {
                // TRACKING: Fail
                const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
                // Try to find the first failed node ID if available
                const firstFailedNodeId = executionErrors.length > 0 ? executionErrors[0].nodeId : undefined;
                trackWorkflowRunFail(errorMsg, firstFailedNodeId);

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
