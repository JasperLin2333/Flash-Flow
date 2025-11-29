import type { AppNode, AppEdge, FlowContext, InputNodeData, ExecutionStatus } from "@/types/flow";
import { getIncomers, getOutgoers } from "@xyflow/react";
import { NodeExecutorFactory } from "../executors/NodeExecutorFactory";

export const createExecutionActions = (set: any, get: any) => ({
    /**
     * 重置执行状态
     */
    resetExecution: () => {
        set((state: any) => ({
            executionStatus: "idle",
            executionError: null,
            flowContext: {},
            nodes: state.nodes.map((n: AppNode) => ({
                ...n,
                data: { ...n.data, status: "idle", executionTime: undefined, output: undefined }
            })),
        }));
    },

    /**
     * 执行整个 Flow
     */
    runFlow: async () => {
        const { nodes, edges, resetExecution } = get();

        // Check if input nodes have data
        const inputNodes = nodes.filter((n: AppNode) => n.type === 'input');
        const hasEmptyInput = inputNodes.some((n: AppNode) => {
            const data = n.data as InputNodeData;
            return !data.text || data.text.trim() === '';
        });

        if (hasEmptyInput) {
            // Open input prompt dialog instead of using default values
            get().openInputPrompt();
            return;
        }

        resetExecution();
        console.log("[RunFlow] Execution reset. Starting flow...");
        set({ executionStatus: "running", executionError: null });

        try {
            // 拓扑排序 / 执行队列
            const entryNodes = nodes.filter((n: AppNode) => !edges.some((e: AppEdge) => e.target === n.id));
            const queue = [...entryNodes];
            const visited = new Set<string>();
            const context: FlowContext = {};

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
                    nodes: state.nodes.map((n: AppNode) =>
                        n.id === nodeId ? { ...n, data: { ...n.data, status: "running" } } : n
                    )
                }));

                // 使用执行器模式
                try {
                    const incomingEdges = get().edges.filter((e: AppEdge) => e.target === nodeId);
                    const upstreamContext: FlowContext = {};
                    
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
                            nodes: state.nodes.map((n: AppNode) =>
                                n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n
                            )
                        }));
                    }
                    throw error;
                }

                // 执行后续节点
                const currentState = get();
                const outgoers = getOutgoers(node, currentState.nodes, currentState.edges);
                for (const outgoer of outgoers) {
                    // Integrity check before next hop
                    checkFlowIntegrity();
                    
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
        }
    },

    /**
     * 执行单个节点（仅开发调试用）
     */
    runNode: async (nodeId: string, mockInputData?: Record<string, unknown>) => {
        const node = get().nodes.find((n: AppNode) => n.id === nodeId);
        if (!node || !node.type) return;
        if (node.type === "input" || node.type === "output") return;

        // 检查是否有传入连线
        const incomingEdges = get().edges.filter((e: AppEdge) => e.target === nodeId);
        if (incomingEdges.length > 0 && !mockInputData) {
            get().openDebugModal(nodeId);
            return;
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
