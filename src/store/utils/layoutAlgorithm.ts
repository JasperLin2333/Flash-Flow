import dagre from 'dagre';
import type { AppNode, AppEdge } from "@/types/flow";

/**
 * 使用Dagre算法计算节点的最优布局位置
 * Dagre是一个专业的有向图布局库，能够：
 * - 自动避免节点重叠
 * - 优化边的路径，减少交叉
 * - 支持不同的布局方向
 * 
 * 优化特性：
 * - 单链路结构使用直线连接（后处理对齐）
 * - 清晰的层级结构
 */
export function calculateOptimalLayout(nodes: AppNode[], edges: AppEdge[]): AppNode[] {
    // 如果没有节点，直接返回
    if (nodes.length === 0) return nodes;

    // 创建一个新的有向图
    const g = new dagre.graphlib.Graph({ compound: true });

    // 设置图的默认配置
    g.setGraph({
        rankdir: 'LR',      // 从左到右布局 (Left to Right)
        align: 'DL',        // 下左对齐，让连接点更容易对齐
        nodesep: 80,        // 同一层级节点之间的间距
        edgesep: 50,        // 边之间的间距
        ranksep: 180,       // 不同层级之间的间距
        marginx: 50,        // 图的左右边距
        marginy: 50,        // 图的上下边距
        ranker: 'longest-path',  // 使用最长路径算法，优化层级分配
    });

    // 设置默认的节点配置
    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));

    // 识别所有的 Branch 节点
    const branchNodes = nodes.filter(node => node.type === 'branch');
    const branchNodeIds = new Set(branchNodes.map(n => n.id));

    // 添加所有节点到图中
    nodes.forEach((node) => {
        // Branch 节点需要更大的高度，因为它有两个输出端口
        const isBranch = node.type === 'branch';
        g.setNode(node.id, {
            width: 260,     // 节点宽度（与CustomNode的min-w-[240px]匹配）
            height: isBranch ? 140 : 120,    // Branch 节点高度更大
        });
    });

    // 为 Branch 节点的边设置优先级，避免交叉
    edges.forEach((edge) => {
        const isBranchSource = branchNodeIds.has(edge.source);

        if (isBranchSource) {
            // Branch 节点的 true 分支优先级更高（权重更大），会被放在上方
            // false 分支优先级较低，会被放在下方
            const weight = edge.sourceHandle === 'true' ? 2 : 1;
            g.setEdge(edge.source, edge.target, {
                weight,
                minlen: 1  // 最小边长，确保节点不会太近
            });
        } else {
            g.setEdge(edge.source, edge.target, {
                weight: 1,
                minlen: 1
            });
        }
    });

    // 运行Dagre布局算法
    dagre.layout(g);

    // 将计算出的位置应用到节点上
    let updatedNodes = nodes.map((node) => {
        const nodeWithPosition = g.node(node.id);

        if (nodeWithPosition) {
            return {
                ...node,
                position: {
                    // Dagre返回的是节点中心点，需要转换为左上角坐标
                    x: nodeWithPosition.x - nodeWithPosition.width / 2,
                    y: nodeWithPosition.y - nodeWithPosition.height / 2,
                },
            };
        }

        return node;
    });

    // 后处理：单链路直线对齐
    updatedNodes = alignStraightLines(updatedNodes, edges, branchNodeIds);

    return updatedNodes;
}

/**
 * 后处理函数：对单链路结构进行直线对齐
 * 对齐节点的垂直中心点（连接点位置），使连接线成为直线
 * 
 * 策略：按拓扑顺序处理，对于每条边，如果目标节点只有一个上游且源节点只有一个下游，
 * 则将目标节点的对齐到源节点的对应连接点
 */
function alignStraightLines(
    nodes: AppNode[],
    edges: AppEdge[],
    branchNodeIds: Set<string>
): AppNode[] {
    // 默认节点高度配置（作为兜底）
    const DEFAULT_HEIGHT = 120;

    // 获取节点实际高度
    function getNodeHeight(node: AppNode): number {
        return node.measured?.height || node.height || DEFAULT_HEIGHT;
    }

    // 获取源节点输出 Handle 的垂直偏移量（相对于节点顶部）
    function getSourceHandleYOffset(node: AppNode, handleId?: string | null): number {
        const height = getNodeHeight(node);

        // Branch 节点的特殊处理
        if (node.type === 'branch') {
            if (handleId === 'true') {
                return height * 0.40; // top-[40%]
            }
            if (handleId === 'false') {
                return height * 0.55; // top-[55%]
            }
        }

        // 默认居中
        return height / 2;
    }

    // 获取目标节点输入 Handle 的垂直偏移量（默认居中）
    function getTargetHandleYOffset(node: AppNode): number {
        const height = getNodeHeight(node);
        return height / 2;
    }

    // 构建邻接表
    const outgoingEdgesMap = new Map<string, AppEdge[]>();
    const incomingEdgesMap = new Map<string, AppEdge[]>();

    edges.forEach(edge => {
        if (!outgoingEdgesMap.has(edge.source)) {
            outgoingEdgesMap.set(edge.source, []);
        }
        outgoingEdgesMap.get(edge.source)!.push(edge);

        if (!incomingEdgesMap.has(edge.target)) {
            incomingEdgesMap.set(edge.target, []);
        }
        incomingEdgesMap.get(edge.target)!.push(edge);
    });

    // 复制节点数组以便修改
    const alignedNodes = nodes.map(node => ({ ...node, position: { ...node.position } }));
    const alignedNodeMap = new Map<string, AppNode>();
    alignedNodes.forEach(node => alignedNodeMap.set(node.id, node));

    // 计算拓扑顺序（Kahn's Algorithm）
    const inDegree = new Map<string, number>();
    alignedNodes.forEach(node => {
        const incoming = incomingEdgesMap.get(node.id) || [];
        inDegree.set(node.id, incoming.length);
    });

    const queue: string[] = [];
    alignedNodes.forEach(node => {
        if (inDegree.get(node.id) === 0) {
            queue.push(node.id);
        }
    });

    const topoOrder: string[] = [];
    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        topoOrder.push(nodeId);

        const outgoing = outgoingEdgesMap.get(nodeId) || [];
        for (const edge of outgoing) {
            const targetId = edge.target;
            const newDegree = (inDegree.get(targetId) || 0) - 1;
            inDegree.set(targetId, newDegree);
            if (newDegree === 0) {
                queue.push(targetId);
            }
        }
    }

    // 按拓扑顺序处理只需要一次遍历（因为父节点处理完后位置已确定）
    for (const nodeId of topoOrder) {
        const node = alignedNodeMap.get(nodeId);
        if (!node) continue;

        const outgoing = outgoingEdgesMap.get(nodeId) || [];

        // 关键修复：只有当源节点只有一个下游，且目标节点只有一个上游时，才进行强制直线对齐
        // 这样可以防止当源节点有分叉时（如 Branch 节点有两个输出），下游节点被强行叠在一起
        if (outgoing.length === 1) {
            const edge = outgoing[0];
            const targetId = edge.target;
            const incoming = incomingEdgesMap.get(targetId) || [];

            if (incoming.length === 1) {
                const targetNode = alignedNodeMap.get(targetId);
                if (!targetNode) continue;

                // 计算对齐位置
                const sourceY = node.position.y;
                const sourceHandleOffset = getSourceHandleYOffset(node, edge.sourceHandle);
                const absoluteSourceHandleY = sourceY + sourceHandleOffset;

                const targetHandleOffset = getTargetHandleYOffset(targetNode);

                // 目标 Y = 源连接点绝对 Y - 目标连接点偏移量
                targetNode.position.y = absoluteSourceHandleY - targetHandleOffset;
            }
        }
    }

    return alignedNodes;
}

/**
 * 计算节点的垂直布局（从上到下）
 * 适用于某些特殊场景
 */
export function calculateVerticalLayout(nodes: AppNode[], edges: AppEdge[]): AppNode[] {
    if (nodes.length === 0) return nodes;

    const g = new dagre.graphlib.Graph();

    g.setGraph({
        rankdir: 'TB',      // 从上到下布局 (Top to Bottom)
        align: 'UL',
        nodesep: 80,
        edgesep: 40,
        ranksep: 150,
        marginx: 50,
        marginy: 50,
    });

    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
        g.setNode(node.id, { width: 260, height: 120 });
    });

    edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const updatedNodes = nodes.map((node) => {
        const nodeWithPosition = g.node(node.id);

        if (nodeWithPosition) {
            return {
                ...node,
                position: {
                    x: nodeWithPosition.x - nodeWithPosition.width / 2,
                    y: nodeWithPosition.y - nodeWithPosition.height / 2,
                },
            };
        }

        return node;
    });

    return updatedNodes;
}
