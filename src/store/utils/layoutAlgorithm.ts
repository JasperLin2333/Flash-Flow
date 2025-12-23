import dagre from 'dagre';
import type { AppNode, AppEdge } from "@/types/flow";

/**
 * 使用Dagre算法计算节点的最优布局位置
 * Dagre是一个专业的有向图布局库，能够：
 * - 自动避免节点重叠
 * - 优化边的路径，减少交叉
 * - 支持不同的布局方向
 */
export function calculateOptimalLayout(nodes: AppNode[], edges: AppEdge[]): AppNode[] {
    // 如果没有节点，直接返回
    if (nodes.length === 0) return nodes;

    // 创建一个新的有向图
    const g = new dagre.graphlib.Graph({ compound: true });

    // 设置图的默认配置
    g.setGraph({
        rankdir: 'LR',      // 从左到右布局 (Left to Right)
        align: undefined,   // 不强制对齐，让Dagre自动优化
        nodesep: 120,       // 增加同一层级节点之间的间距，避免交叉
        edgesep: 80,        // 增加边之间的间距，减少交叉
        ranksep: 250,       // 增加不同层级之间的间距
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
    const updatedNodes = nodes.map((node) => {
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

    return updatedNodes;
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
