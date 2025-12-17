import type { AppNode } from "@/types/flow";

/**
 * 节点查找索引，包含 ID 和 Label 的映射
 * 用于 O(1) 时间复杂度的节点查找
 */
export interface NodeIndex {
    byId: Map<string, AppNode>;
    byLabel: Map<string, AppNode>;
}

/**
 * 构建节点查找索引
 * 
 * @param nodes - 节点列表
 * @returns 节点索引对象，包含 byId 和 byLabel 两个 Map
 */
export function buildNodeIndex(nodes: AppNode[]): NodeIndex {
    const byId = new Map<string, AppNode>();
    const byLabel = new Map<string, AppNode>();

    for (const node of nodes) {
        byId.set(node.id, node);
        const label = node.data?.label as string | undefined;
        if (label) {
            byLabel.set(label, node);
        }
    }

    return { byId, byLabel };
}

/**
 * 构建节点 ID 到节点的映射 Map
 * 用于 O(1) 时间复杂度的节点查找
 * 
 * @param nodes - 节点列表
 * @returns Map<nodeId, node>
 */
export function buildNodeMap(nodes: AppNode[]): Map<string, AppNode> {
    return new Map(nodes.map(n => [n.id, n]));
}

/**
 * 从变量引用中提取节点 ID
 * 用于解析如 {{LLM1.response}} 或 {{节点名.字段}} 格式的变量引用
 * 
 * @param value - 变量引用字符串，如 "{{LLM1.response}}"
 * @param nodes - 节点列表
 * @returns 节点 ID 或 null
 */
export function resolveSourceNodeId(
    value: string,
    nodes: AppNode[]
): string | null {
    // 提取 {{xxx}} 中的变量名
    const match = value.match(/\{\{(.+?)\}\}/);
    if (!match) return null;

    const varPath = match[1]; // 例如 "LLM1.response" 或 "response"

    // 尝试匹配 "节点名.字段" 格式
    const dotIndex = varPath.indexOf('.');
    if (dotIndex > 0) {
        const nodeLabel = varPath.substring(0, dotIndex);
        const matchedNode = nodes.find(n =>
            (n.data?.label as string) === nodeLabel ||
            n.id === nodeLabel
        );
        if (matchedNode) return matchedNode.id;
    }

    // 尝试直接匹配节点 label
    const directMatch = nodes.find(n =>
        (n.data?.label as string) === varPath ||
        n.id === varPath
    );
    if (directMatch) return directMatch.id;

    return null;
}

/**
 * 使用预构建的索引从变量引用中提取节点 ID（高性能版本）
 * 适用于需要多次解析变量引用的场景
 * 
 * @param value - 变量引用字符串，如 "{{LLM1.response}}"
 * @param index - 预构建的节点索引
 * @returns 节点 ID 或 null
 */
export function resolveSourceNodeIdWithIndex(
    value: string,
    index: NodeIndex
): string | null {
    // 提取 {{xxx}} 中的变量名
    const match = value.match(/\{\{(.+?)\}\}/);
    if (!match) return null;

    const varPath = match[1];

    // 尝试匹配 "节点名.字段" 格式
    const dotIndex = varPath.indexOf('.');
    if (dotIndex > 0) {
        const nodeLabel = varPath.substring(0, dotIndex);
        // 先查 label，再查 id
        const byLabel = index.byLabel.get(nodeLabel);
        if (byLabel) return byLabel.id;
        const byId = index.byId.get(nodeLabel);
        if (byId) return byId.id;
    }

    // 尝试直接匹配
    const byLabel = index.byLabel.get(varPath);
    if (byLabel) return byLabel.id;
    const byId = index.byId.get(varPath);
    if (byId) return byId.id;

    return null;
}

/**
 * 从 ContentSource 对象中解析节点 ID
 * 
 * @param source - ContentSource 对象
 * @param nodes - 节点列表
 * @returns 节点 ID 或 null
 */
export function resolveSourceNodeIdFromSource(
    source: { type: string; value: string },
    nodes: AppNode[]
): string | null {
    if (source.type !== 'variable') return null;
    return resolveSourceNodeId(source.value, nodes);
}
