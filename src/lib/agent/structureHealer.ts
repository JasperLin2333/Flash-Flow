/**
 * 结构自愈模块 - Structure Healer
 * 
 * 第二层自动修复：处理工作流的结构性问题
 * - 循环依赖：自动删除形成环的边
 * - 孤岛节点：自动连接到拓扑上最近的逻辑前驱
 * - 重复边：去重
 * - 无效边：删除指向不存在节点的边
 */

export interface StructureHealerResult {
    fixedNodes: any[];
    fixedEdges: any[];
    fixes: string[];      // 修复日志
    errors: string[];     // 无法修复的错误（理论上不应该有）
}

interface NodeInfo {
    id: string;
    type: string;
    label: string;
}

interface EdgeInfo {
    id?: string;
    source: string;
    target: string;
}

/**
 * 核心结构自愈函数
 */
export function healStructure(nodes: any[], edges: any[]): StructureHealerResult {
    const fixes: string[] = [];
    const errors: string[] = [];

    const healedNodes = JSON.parse(JSON.stringify(nodes));
    const healedEdges: EdgeInfo[] = JSON.parse(JSON.stringify(edges || []));

    const nodeMap = new Map<string, NodeInfo>();
    const nodeIds = new Set<string>();
    healedNodes.forEach((node: any) => {
        const info: NodeInfo = {
            id: node.id,
            type: node.type,
            label: node.data?.label || node.id
        };
        nodeMap.set(node.id, info);
        nodeIds.add(node.id);
    });

    const invalidEdges = healedEdges.filter(e => !e?.source || !e?.target || !nodeIds.has(e.source) || !nodeIds.has(e.target));
    if (invalidEdges.length > 0) {
        fixes.push(`检测到无效边 ${invalidEdges.length} 条（仅报告，不自动修复）`);
    }

    const edgeSet = new Set<string>();
    let duplicateCount = 0;
    for (const e of healedEdges) {
        const key = `${e?.source || ""}::${e?.target || ""}`;
        if (edgeSet.has(key)) duplicateCount++;
        else edgeSet.add(key);
    }
    if (duplicateCount > 0) {
        fixes.push(`检测到重复边 ${duplicateCount} 条（仅报告，不自动修复）`);
    }

    const hasCycle = (() => {
        const adj = new Map<string, string[]>();
        const visited = new Set<string>();
        const stack = new Set<string>();
        for (const id of nodeIds) adj.set(id, []);
        for (const e of healedEdges) {
            if (!e?.source || !e?.target) continue;
            if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
            adj.get(e.source)?.push(e.target);
        }
        const dfs = (id: string): boolean => {
            visited.add(id);
            stack.add(id);
            for (const next of adj.get(id) || []) {
                if (!visited.has(next)) {
                    if (dfs(next)) return true;
                } else if (stack.has(next)) {
                    return true;
                }
            }
            stack.delete(id);
            return false;
        };
        for (const id of nodeIds) {
            if (!visited.has(id) && dfs(id)) return true;
        }
        return false;
    })();
    if (hasCycle) {
        fixes.push("检测到循环依赖（仅报告，不自动修复）");
    }

    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const id of nodeIds) {
        inDegree.set(id, 0);
        outDegree.set(id, 0);
    }
    for (const e of healedEdges) {
        if (!e?.source || !e?.target) continue;
        if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
    }
    const isolated = healedNodes.filter((n: any) => {
        const id = n?.id;
        if (typeof id !== "string" || !id) return false;
        const inD = inDegree.get(id) || 0;
        const outD = outDegree.get(id) || 0;
        if (inD !== 0 || outD !== 0) return false;
        return true;
    });
    if (isolated.length > 0) {
        fixes.push(`检测到孤岛节点 ${isolated.length} 个（仅报告，不自动修复）`);
    }

    return {
        fixedNodes: healedNodes,
        fixedEdges: healedEdges,
        fixes,
        errors
    };
}

/**
 * 检测并修复循环依赖
 * 策略：使用 DFS 找到环，删除环中最后添加的边（即形成环的那条边）
 */
function _detectAndFixCycles(
    nodes: any[],
    edges: EdgeInfo[],
    nodeMap: Map<string, NodeInfo>
): { edges: EdgeInfo[]; fixes: string[] } {
    const fixes: string[] = [];
    let currentEdges = [...edges];

    // DFS 检测环，返回环中的边（如果存在）
    const findCycleEdge = (edgeList: EdgeInfo[]): EdgeInfo | null => {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        // 任何时刻由于是遍历图，我们可能无法简单地在递归参数里传 edge，因为 adj 存的是 string[]
        // 但我们可以构建更详细的 adj 存 EdgeInfo[]
        const adjEdges = new Map<string, EdgeInfo[]>();
        nodes.forEach(n => adjEdges.set(n.id, []));
        edgeList.forEach(e => {
            adjEdges.get(e.source)?.push(e);
        });

        function dfs(nodeId: string): EdgeInfo | null {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = adjEdges.get(nodeId) || [];
            for (const edge of neighbors) {
                const neighbor = edge.target;

                if (!visited.has(neighbor)) {
                    const cycleEdge = dfs(neighbor);
                    if (cycleEdge) return cycleEdge;
                } else if (recursionStack.has(neighbor)) {
                    // 发现环！这就是那条罪魁祸首的边 (Back Edge)
                    return edge;
                }
            }

            recursionStack.delete(nodeId);
            return null;
        }

        for (const node of nodes) {
            if (!visited.has(node.id)) {
                const cycleEdge = dfs(node.id);
                if (cycleEdge) return cycleEdge;
            }
        }

        return null;
    };

    // 迭代移除环，直到无环
    let maxIterations = edges.length; // 防止无限循环
    let iteration = 0;

    while (iteration < maxIterations) {
        const cycleEdge = findCycleEdge(currentEdges);
        if (!cycleEdge) break;

        // 移除这条边
        currentEdges = currentEdges.filter(e =>
            !(e.source === cycleEdge.source && e.target === cycleEdge.target)
        );

        const sourceLabel = nodeMap.get(cycleEdge.source)?.label || cycleEdge.source;
        const targetLabel = nodeMap.get(cycleEdge.target)?.label || cycleEdge.target;
        fixes.push(`修复循环依赖: 删除边 "${sourceLabel}" → "${targetLabel}"`);

        iteration++;
    }

    return { edges: currentEdges, fixes };
}

/**
 * 检测并修复孤岛节点
 * 策略：
 * 1. 找出所有没有入边也没有出边的节点（排除合法的起点 input 和终点 output）
 * 2. 根据节点类型，自动连接到最合理的前驱/后继
 */
function _detectAndFixIslands(
    nodes: any[],
    edges: EdgeInfo[],
    nodeMap: Map<string, NodeInfo>
): { edges: EdgeInfo[]; fixes: string[] } {
    const fixes: string[] = [];
    const currentEdges = [...edges];

    // 计算入度和出度
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    nodes.forEach(n => {
        inDegree.set(n.id, 0);
        outDegree.set(n.id, 0);
    });

    edges.forEach(e => {
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
    });

    // 找出孤岛节点
    const isolatedNodes: NodeInfo[] = [];
    nodes.forEach(n => {
        const inD = inDegree.get(n.id) || 0;
        const outD = outDegree.get(n.id) || 0;

        // 完全孤立（无入边无出边）
        if (inD === 0 && outD === 0) {
            // input 类型没有入边是正常的
            // output 类型没有出边是正常的
            // 但如果 input 也没有出边，或 output 没有入边，就是孤岛
            const info = nodeMap.get(n.id);
            if (info) {
                if (info.type === 'input') {
                    // input 无出边 = 孤岛
                    isolatedNodes.push(info);
                } else if (info.type === 'output') {
                    // output 无入边 = 孤岛
                    isolatedNodes.push(info);
                } else {
                    // 其他类型完全孤立
                    isolatedNodes.push(info);
                }
            }
        }
    });

    if (isolatedNodes.length === 0) {
        return { edges: currentEdges, fixes };
    }

    // 找出可能的连接点
    // 按类型优先级排序节点：input > llm/rag/tool > branch > output
    const typePriority: Record<string, number> = {
        'input': 0,
        'llm': 1,
        'rag': 1,
        'tool': 1,
        'imagegen': 1,
        'branch': 2,
        'output': 3
    };

    const sortedNodes = [...nodes].sort((a, b) => {
        const pA = typePriority[a.type] ?? 1;
        const pB = typePriority[b.type] ?? 1;
        return pA - pB;
    });

    // 对每个孤岛节点，找最合适的连接
    for (const isolated of isolatedNodes) {
        const isolatedType = isolated.type;
        const isolatedPriority = typePriority[isolatedType] ?? 1;

        // 找前驱：优先级比自己低的最后一个节点
        let predecessor: NodeInfo | null = null;
        for (const n of sortedNodes) {
            if (n.id === isolated.id) continue;
            const nPriority = typePriority[n.type] ?? 1;
            if (nPriority < isolatedPriority) {
                predecessor = nodeMap.get(n.id) || null;
            }
        }

        // 找后继：优先级比自己高的第一个节点
        let successor: NodeInfo | null = null;
        for (const n of sortedNodes) {
            if (n.id === isolated.id) continue;
            const nPriority = typePriority[n.type] ?? 1;
            if (nPriority > isolatedPriority) {
                successor = nodeMap.get(n.id) || null;
                break;
            }
        }

        // 根据节点类型决定连接方式
        if (isolatedType === 'input' && successor) {
            // input 孤岛：连接到后继
            currentEdges.push({
                source: isolated.id,
                target: successor.id,
                id: `edge_heal_${isolated.id}_${successor.id}`
            });
            fixes.push(`修复孤岛: 连接 "${isolated.label}" → "${successor.label}"`);
        } else if (isolatedType === 'output' && predecessor) {
            // output 孤岛：从前驱连接过来
            currentEdges.push({
                source: predecessor.id,
                target: isolated.id,
                id: `edge_heal_${predecessor.id}_${isolated.id}`
            });
            fixes.push(`修复孤岛: 连接 "${predecessor.label}" → "${isolated.label}"`);
        } else if (predecessor && successor) {
            // 中间节点孤岛：连接前驱和后继
            currentEdges.push({
                source: predecessor.id,
                target: isolated.id,
                id: `edge_heal_${predecessor.id}_${isolated.id}`
            });
            currentEdges.push({
                source: isolated.id,
                target: successor.id,
                id: `edge_heal_${isolated.id}_${successor.id}`
            });
            fixes.push(`修复孤岛: 连接 "${predecessor.label}" → "${isolated.label}" → "${successor.label}"`);
        } else if (predecessor) {
            // 只有前驱
            currentEdges.push({
                source: predecessor.id,
                target: isolated.id,
                id: `edge_heal_${predecessor.id}_${isolated.id}`
            });
            fixes.push(`修复孤岛: 连接 "${predecessor.label}" → "${isolated.label}"`);
        } else if (successor) {
            // 只有后继
            currentEdges.push({
                source: isolated.id,
                target: successor.id,
                id: `edge_heal_${isolated.id}_${successor.id}`
            });
            fixes.push(`修复孤岛: 连接 "${isolated.label}" → "${successor.label}"`);
        }
        // 如果既没有前驱也没有后继（单节点工作流），不做处理
    }

    return { edges: currentEdges, fixes };
}
