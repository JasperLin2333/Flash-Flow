import type { AppNode, AppEdge } from "@/types/flow";
import { getIncomers } from "@xyflow/react";

/**
 * 计算每个节点的拓扑层级
 * Level 0 = 入口节点（无上游）
 * Level N = max(所有前置节点层级) + 1
 * 
 * @param nodes 所有节点
 * @param edges 所有边
 * @returns Map<nodeId, level>
 */
export function calculateTopologicalLevels(
    nodes: AppNode[],
    edges: AppEdge[]
): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    // 递归计算节点层级
    const calculateLevel = (nodeId: string): number => {
        if (levels.has(nodeId)) {
            return levels.get(nodeId)!;
        }

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return 0;

        const incomers = getIncomers(node, nodes, edges);

        // 入口节点（无上游）= Level 0
        if (incomers.length === 0) {
            levels.set(nodeId, 0);
            return 0;
        }

        // 计算所有上游节点的最大层级
        let maxUpstreamLevel = -1;
        for (const incomer of incomers) {
            const upstreamLevel = calculateLevel(incomer.id);
            maxUpstreamLevel = Math.max(maxUpstreamLevel, upstreamLevel);
        }

        const level = maxUpstreamLevel + 1;
        levels.set(nodeId, level);
        return level;
    };

    // 计算所有节点的层级
    for (const node of nodes) {
        if (!visited.has(node.id)) {
            calculateLevel(node.id);
            visited.add(node.id);
        }
    }

    return levels;
}

/**
 * 按层级分组节点
 * 
 * @param nodes 所有节点
 * @param levels 节点层级映射
 * @returns Map<level, nodeId[]>
 */
export function groupNodesByLevel(
    nodes: AppNode[],
    levels: Map<string, number>
): Map<number, string[]> {
    const groups = new Map<number, string[]>();

    for (const node of nodes) {
        const level = levels.get(node.id) ?? 0;
        if (!groups.has(level)) {
            groups.set(level, []);
        }
        groups.get(level)!.push(node.id);
    }

    return groups;
}

/**
 * 获取节点的所有下游节点（递归）
 * 
 * @param nodeId 起始节点 ID
 * @param edges 所有边
 * @param sourceHandle 可选，仅获取特定 handle 的下游
 * @returns 所有下游节点 ID 集合
 */
export function getDescendants(
    nodeId: string,
    edges: AppEdge[],
    sourceHandle?: string
): Set<string> {
    const descendants = new Set<string>();
    const queue: string[] = [];

    // 初始：获取直接下游
    const directOutgoing = edges.filter(e => {
        if (e.source !== nodeId) return false;
        if (sourceHandle !== undefined && e.sourceHandle !== sourceHandle) return false;
        return true;
    });

    for (const edge of directOutgoing) {
        if (!descendants.has(edge.target)) {
            descendants.add(edge.target);
            queue.push(edge.target);
        }
    }

    // BFS 遍历所有下游
    while (queue.length > 0) {
        const current = queue.shift()!;
        const outgoing = edges.filter(e => e.source === current);
        for (const edge of outgoing) {
            if (!descendants.has(edge.target)) {
                descendants.add(edge.target);
                queue.push(edge.target);
            }
        }
    }

    return descendants;
}

/**
 * 检查节点是否可以执行（所有上游节点都已完成）
 * 
 * @param nodeId 节点 ID
 * @param edges 所有边
 * @param completedNodes 已完成的节点集合
 * @param blockedNodes 被阻塞的节点集合（分支未选中路径）
 * @returns 是否可执行
 */
export function canExecuteNode(
    nodeId: string,
    edges: AppEdge[],
    completedNodes: Set<string>,
    blockedNodes: Set<string>
): boolean {
    // 如果节点被阻塞，不执行
    if (blockedNodes.has(nodeId)) {
        return false;
    }

    // 获取所有上游节点
    const incomingEdges = edges.filter(e => e.target === nodeId);

    // 入口节点（无上游）总是可执行
    if (incomingEdges.length === 0) {
        return true;
    }

    // 检查所有上游节点是否都已完成或被阻塞
    for (const edge of incomingEdges) {
        const sourceId = edge.source;
        // 上游必须已完成或被阻塞（被阻塞的分支不需要等待）
        if (!completedNodes.has(sourceId) && !blockedNodes.has(sourceId)) {
            return false;
        }
    }

    return true;
}
