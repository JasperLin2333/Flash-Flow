import type { AppNode, BaseNodeData, ExecutionStatus, InputNodeData, OutputNodeData, RAGNodeData } from "@/types/flow";

/**
 * 节点状态更新辅助函数
 * 用于减少 executionActions 中的重复代码
 */

/**
 * 更新单个节点的状态
 * @param nodes 节点数组
 * @param nodeId 目标节点 ID
 * @param status 新状态
 * @param additionalData 可选的额外数据（如 executionTime, output）
 */
export function updateNodeStatus(
    nodes: AppNode[],
    nodeId: string,
    status: ExecutionStatus,
    additionalData?: Partial<BaseNodeData>
): AppNode[] {
    return nodes.map((n: AppNode) =>
        n.id === nodeId
            ? { ...n, data: { ...n.data, status, ...additionalData } }
            : n
    );
}

/**
 * 批量重置所有节点状态为 idle，并清除运行时数据
 * - Input 节点：清除 text, files, formData
 * - Output 节点：清除 text
 * - RAG 节点：清除 searchQuery, foundDocuments
 * - 所有节点：清除 status, executionTime, output
 */
export function resetAllNodesStatus(nodes: AppNode[]): AppNode[] {
    return nodes.map((n: AppNode) => {
        // 基础重置数据
        const baseReset = {
            status: "idle" as ExecutionStatus,
            executionTime: undefined,
            output: undefined,
        };

        // 根据节点类型清除特定数据
        switch (n.type) {
            case "input": {
                const inputData = n.data as InputNodeData;
                return {
                    ...n,
                    data: {
                        ...inputData,
                        ...baseReset,
                        // 🚨 FIX: 保留用户输入数据，只清除执行状态
                        // text, files, formData 是用户的有效输入，不应被 resetExecution 清空
                    },
                };
            }
            case "output": {
                const outputData = n.data as OutputNodeData;
                return {
                    ...n,
                    data: {
                        ...outputData,
                        ...baseReset,
                        text: undefined,      // 清除输出文本
                    },
                };
            }
            case "rag": {
                const ragData = n.data as RAGNodeData;
                return {
                    ...n,
                    data: {
                        ...ragData,
                        ...baseReset,
                        searchQuery: undefined,     // 清除搜索查询
                        foundDocuments: undefined,  // 清除找到的文档
                    },
                };
            }
            default:
                return {
                    ...n,
                    data: { ...n.data, ...baseReset },
                };
        }
    });
}
