import type { AppNode, AppEdge } from "@/types/flow";
import { getOutgoers } from "@xyflow/react";

/**
 * 检测图中是否存在循环
 * @param nodeId 起始节点 ID
 * @param nodes 所有节点
 * @param edges 所有边
 * @param visited 已访问节点集合
 * @param stack 当前路径栈
 * @returns 是否存在循环
 */
export function hasCycle(
    nodeId: string,
    nodes: AppNode[],
    edges: AppEdge[],
    visited = new Set<string>(),
    stack = new Set<string>()
): boolean {
    if (stack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    stack.add(nodeId);

    const outgoers = getOutgoers({ id: nodeId } as AppNode, nodes, edges);
    for (const out of outgoers) {
        if (hasCycle(out.id, nodes, edges, visited, stack)) return true;
    }

    stack.delete(nodeId);
    return false;
}
