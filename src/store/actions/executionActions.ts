import type { AppNode, AppEdge, FlowContext, InputNodeData, ExecutionStatus } from "@/types/flow";
import { getIncomers, getOutgoers } from "@xyflow/react";
import { nanoid } from "nanoid";
import { NodeExecutorFactory } from "../executors/NodeExecutorFactory";
import { updateNodeStatus, resetAllNodesStatus } from "../utils/nodeStatusUtils";
import { hasCycle } from "../utils/cycleDetection";

export const createExecutionActions = (set: any, get: any) => ({
    /**
     * 重置执行状态
     */
    resetExecution: () => {
        set((state: any) => ({
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
        // A valid input can be: text, file upload, or structured form
        const inputNodes = nodes.filter((n: AppNode) => n.type === 'input');
        const hasInvalidInput = inputNodes.some((n: AppNode) => {
            const data = n.data as InputNodeData;
            const hasText = data.text && data.text.trim() !== '';
            const hasFileInput = data.enableFileInput === true;
            const hasFormInput = data.enableStructuredForm === true && Array.isArray(data.formFields) && data.formFields.length > 0;

            // Input is invalid only if none of the input methods have content
            // Note: For file/form, we just check if they're enabled - actual content is validated at runtime
            return !hasText && !hasFileInput && !hasFormInput;
        });

        if (hasInvalidInput) {
            // Open input prompt dialog instead of using default values
            get().openInputPrompt();
            return;
        }

        // 3. 执行锁（防止并发执行导致配额多次扣减）
        if ((get() as any)._executionLock) {
            console.warn('[RunFlow] 执行已在进行中，请等待完成');
            return;
        }
        (set as any)({ _executionLock: true });

        resetExecution();
        console.log("[RunFlow] Execution reset. Starting flow...");
        set({ executionStatus: "running", executionError: null });

        try {
            // 拓扑排序 / 执行队列
            const entryNodes = nodes.filter((n: AppNode) => !edges.some((e: AppEdge) => e.target === n.id));
            const queue = [...entryNodes];
            const visited = new Set<string>();

            // 创建执行上下文，包含元数据用于 LLM 记忆功能
            // 如果传入 sessionId 则使用，否则生成新的（用于非记忆场景）
            const effectiveSessionId = sessionId || nanoid(10);
            const context: FlowContext = {
                _meta: {
                    flowId: currentFlowId,
                    sessionId: effectiveSessionId,
                }
            };

            // Capture initial flow structure snapshot
            const initialNodeIds = new Set(nodes.map((n: AppNode) => n.id));

            // Guard: Integrity check function
            const checkFlowIntegrity = () => {
                const currentNodes = get().nodes;
                const currentIds = new Set(currentNodes.map((n: AppNode) => n.id));

                // Check if any original node is missing
                for (const id of initialNodeIds) {
                    if (!currentIds.has(id)) {
                        throw new Error("Execution interrupted: Flow structure changed (node deleted).");
                    }
                }
            };

            const executeNode = async (nodeId: string) => {
                // Pre-flight integrity check
                checkFlowIntegrity();

                const node = get().nodes.find((n: AppNode) => n.id === nodeId);
                // Double check specific node existence (redundant but safe)
                if (!node) {
                    throw new Error("Node deleted during execution");
                }
                if (!node.type) return;

                // 更新状态为 running
                set((state: any) => ({
                    nodes: updateNodeStatus(state.nodes, nodeId, "running")
                }));

                // 使用执行器模式
                try {
                    const incomingEdges = get().edges.filter((e: AppEdge) => e.target === nodeId);
                    const upstreamContext: FlowContext = {
                        // 保留 _meta 以便 LLM 节点访问 flowId 和 sessionId
                        _meta: context._meta,
                    };

                    // 构建上游上下文
                    incomingEdges.forEach((edge: AppEdge) => {
                        const upstreamOutput = context[edge.source];
                        if (upstreamOutput) {
                            upstreamContext[edge.source] = upstreamOutput;
                        }
                    });

                    const executor = NodeExecutorFactory.getExecutor(node.type);
                    const { output, executionTime } = await executor.execute(node, upstreamContext);

                    // Post-execution integrity check
                    checkFlowIntegrity();

                    // 更新上下文
                    context[nodeId] = output;
                    set({ flowContext: { ...context } });

                    // 更新状态为completed
                    const outputObj = output as Record<string, unknown>;
                    const outputText = typeof outputObj['text'] === 'string' ? (outputObj['text'] as string) : undefined;
                    set((state: any) => ({
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
                } catch (error) {
                    console.error(`Node ${nodeId} execution failed:`, error);
                    // Only update status if node still exists
                    if (get().nodes.find((n: AppNode) => n.id === nodeId)) {
                        set((state: any) => ({
                            nodes: updateNodeStatus(state.nodes, nodeId, "error")
                        }));
                    }
                    throw error;
                }

                // 执行后续节点
                const currentState = get();
                const outgoers = getOutgoers(node, currentState.nodes, currentState.edges);

                // Branch Logic: Determine which path to take
                let allowedSourceHandle: string | null = null;
                if (node.type === 'branch') {
                    const branchOutput = context[nodeId] as Record<string, unknown>;
                    // Default to false if result is missing
                    const conditionResult = !!branchOutput?.conditionResult;
                    allowedSourceHandle = conditionResult ? 'true' : 'false';
                    console.log(`[Execution] Branch node ${nodeId} result: ${conditionResult} -> taking handle ${allowedSourceHandle}`);
                }

                for (const outgoer of outgoers) {
                    // Integrity check before next hop
                    checkFlowIntegrity();

                    // Branch filtering logic
                    if (allowedSourceHandle) {
                        // Find edge connecting node -> outgoer
                        const edge = currentState.edges.find((e: AppEdge) => e.source === node.id && e.target === outgoer.id);
                        // If edge exists and connected to the wrong handle, skip it
                        if (edge && edge.sourceHandle !== allowedSourceHandle) {
                            continue;
                        }
                    }

                    if (!visited.has(outgoer.id)) {
                        visited.add(outgoer.id);
                        await executeNode(outgoer.id);
                    }
                }
            };

            for (const node of queue) {
                visited.add(node.id);
                await executeNode(node.id);
            }

            // Log before setting completed
            console.log("[RunFlow] All nodes executed. Setting completed.", {
                finalContext: get().flowContext
            });

            set({ executionStatus: "completed" });
        } catch (error) {
            console.error('Flow execution failed:', error);
            set({
                executionStatus: "error" as ExecutionStatus,
                executionError: error instanceof Error ? error.message : "Unknown error occurred"
            });
        } finally {
            // 释放执行锁
            (set as any)({ _executionLock: false });
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

        set((state: any) => ({
            nodes: state.nodes.map((n: AppNode) =>
                n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n
            ),
        }));

        try {
            const upstreamContext: FlowContext = mockInputData ? { mock: mockInputData } : {};
            const executor = NodeExecutorFactory.getExecutor(node.type);
            const { output, executionTime } = await executor.execute(node, upstreamContext);

            // Check if node still exists (it might have been deleted during execution)
            if (!get().nodes.find((n: AppNode) => n.id === nodeId)) {
                throw new Error("Node deleted during execution");
            }

            const prev = get().flowContext;
            set({ flowContext: { ...prev, [nodeId]: output } });

            set((state: any) => ({
                nodes: state.nodes.map((n: AppNode) =>
                    n.id === nodeId
                        ? {
                            ...n,
                            data: { ...n.data, status: "completed", executionTime, output },
                        }
                        : n
                ),
            }));
        } catch (error) {
            console.error(`Node ${nodeId} execution failed:`, error);
            set((state: any) => ({
                nodes: state.nodes.map((n: AppNode) =>
                    n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n
                )
            }));
        }
    },
});
