import type { AppNode, AppEdge, FlowContext, InputNodeData, ExecutionStatus, FlowState } from "@/types/flow";
import { getIncomers, getOutgoers } from "@xyflow/react";
import { nanoid } from "nanoid";
import { NodeExecutorFactory } from "../executors/NodeExecutorFactory";
import { updateNodeStatus, resetAllNodesStatus } from "../utils/nodeStatusUtils";
import { hasCycle } from "../utils/cycleDetection";

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

        if (isDebugRunner && (node.type === 'input' || node.type === 'output')) {
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
            const outputText = typeof outputObj['text'] === 'string' ? (outputObj['text'] as string) : undefined;

            set((state: FlowState) => ({
                nodes: state.nodes.map((n: AppNode) => n.id === nodeId ? {
                    ...n,
                    data: {
                        ...n.data,
                        status: "completed",
                        executionTime: executionTime,
                        output: output,
                        ...(n.type === 'output' && outputText ? { text: outputText } : {})
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
         */
        resetExecution: () => {
            set((state: FlowState) => ({
                executionStatus: "idle",
                executionError: null,
                flowContext: {},
                nodes: resetAllNodesStatus(state.nodes),
                // Reset streaming state
                streamingText: "",
                isStreaming: false,
                // 重置中断标志，确保新的流式输出可以正常工作
                // 这是必须的，因为 abortStreaming 会设置此标志为 true
                _streamingAborted: false,
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

            // 2. Check if input nodes have valid data
            const inputNodes = nodes.filter((n: AppNode) => n.type === 'input');
            const hasInvalidInput = inputNodes.some((n: AppNode) => {
                const data = n.data as InputNodeData;
                const hasText = data.text && data.text.trim() !== '';
                const hasFileInput = data.enableFileInput === true;
                const hasFormInput = data.enableStructuredForm === true && Array.isArray(data.formFields) && data.formFields.length > 0;
                return !hasText && !hasFileInput && !hasFormInput;
            });

            if (hasInvalidInput) {
                get().openInputPrompt();
                return;
            }

            // 3. 执行锁
            if (get()._executionLock) {
                console.warn('[RunFlow] 执行已在进行中，请等待完成');
                return;
            }
            set({ _executionLock: true });

            resetExecution();
            // console.log("[RunFlow] Execution reset. Starting flow...");
            set({ executionStatus: "running", executionError: null });

            try {
                const entryNodes = nodes.filter((n: AppNode) => !edges.some((e: AppEdge) => e.target === n.id));
                const queue = [...entryNodes];
                const visited = new Set<string>();

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
                        nodeLabels, // 添加节点标签映射，用于变量解析
                    }
                };

                set({ flowContext: context });

                const initialNodeIds = new Set(nodes.map((n: AppNode) => n.id));

                const checkFlowIntegrity = () => {
                    const currentNodes = get().nodes;
                    const currentIds = new Set(currentNodes.map((n: AppNode) => n.id));
                    for (const id of initialNodeIds) {
                        if (!currentIds.has(id)) {
                            throw new Error("Execution interrupted: Flow structure changed (node deleted).");
                        }
                    }
                };

                const traverseNode = async (nodeId: string) => {
                    checkFlowIntegrity();

                    const result = await executeSingleNode(nodeId, context, false);

                    if (result) {
                        context[nodeId] = result.output;
                        set({ flowContext: { ...context } });
                    }

                    checkFlowIntegrity();

                    const currentState = get();
                    const node = currentState.nodes.find((n: AppNode) => n.id === nodeId);
                    if (!node) return;

                    const outgoers = getOutgoers(node, currentState.nodes, currentState.edges);

                    let allowedSourceHandle: string | null = null;
                    if (node.type === 'branch') {
                        const branchOutput = context[nodeId] as Record<string, unknown>;
                        const conditionResult = !!branchOutput?.conditionResult;
                        allowedSourceHandle = conditionResult ? 'true' : 'false';
                        // console.log(`[Execution] Branch node ${nodeId} result: ${conditionResult} -> taking handle ${allowedSourceHandle}`);
                    }

                    for (const outgoer of outgoers) {
                        checkFlowIntegrity();

                        if (allowedSourceHandle) {
                            const edge = currentState.edges.find((e: AppEdge) => e.source === node.id && e.target === outgoer.id);
                            if (edge && edge.sourceHandle !== allowedSourceHandle) {
                                continue;
                            }
                        }

                        if (!visited.has(outgoer.id)) {
                            visited.add(outgoer.id);
                            await traverseNode(outgoer.id);
                        }
                    }
                };

                for (const node of queue) {
                    visited.add(node.id);
                    await traverseNode(node.id);
                }

                // console.log("[RunFlow] All nodes executed. Setting completed.", {
                //     finalContext: get().flowContext
                // });

                set({ executionStatus: "completed" });
            } catch (error) {
                console.error('Flow execution failed:', error);
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
            if (node.type === "input" || node.type === "output") return;

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
                console.error(`Single node run error caught in action:`, error);
            }
        },
    };
};
