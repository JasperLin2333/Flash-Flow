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
    const g = new dagre.graphlib.Graph();

    // 设置图的默认配置
    g.setGraph({
        rankdir: 'LR',      // 从左到右布局 (Left to Right)
        align: 'UL',        // 对齐方式：上左对齐
        nodesep: 80,        // 同一层级节点之间的间距
        edgesep: 40,        // 边之间的间距
        ranksep: 200,       // 不同层级之间的间距
        marginx: 50,        // 图的左右边距
        marginy: 50,        // 图的上下边距
    });

    // 设置默认的节点配置
    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));

    // 添加所有节点到图中
    nodes.forEach((node) => {
        g.setNode(node.id, {
            width: 260,     // 节点宽度（与CustomNode的min-w-[240px]匹配）
            height: 120,    // 节点高度的估算值
        });
    });

    // 添加所有边到图中
    edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
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
