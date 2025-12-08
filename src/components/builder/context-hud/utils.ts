import type { UpstreamVariable } from "./types";

/**
 * 从文本中提取 {{变量名}} 格式的变量
 * @param text 要解析的文本
 * @returns 变量名数组（去重）
 */
export function extractVariablesFromText(text: string): string[] {
    if (!text) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const variableName = match[1].trim();
        if (variableName && !matches.includes(variableName)) {
            matches.push(variableName);
        }
    }
    return matches;
}

/**
 * 递归展开嵌套对象为可引用的变量列表
 * 只显示叶子节点（非对象的值），不显示中间对象层级
 * 例如：{ formData: { destination: "巴黎", date: "2025-01-01" } } 
 * 会生成变量：formData.destination, formData.date（不包含 formData 本身）
 */
export function flattenObjectToVariables(
    obj: Record<string, unknown>,
    nodeLabel: string,
    nodeId: string,
    prefix: string = ""
): UpstreamVariable[] {
    const vars: UpstreamVariable[] = [];
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('_')) continue;
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        // 如果是数组（如 files），展开每个元素的属性
        if (Array.isArray(value)) {
            // 1. 添加数组整体变量（用于 RAG 动态模式的 inputMappings.files）
            vars.push({
                nodeLabel,
                nodeId,
                field: fieldPath,
                value: `数组 (${value.length} 项)`,
            });

            // 2. 展开每个元素的属性
            value.forEach((item, index) => {
                if (item !== null && typeof item === 'object') {
                    // 对数组中的每个对象，展开其属性
                    vars.push(...flattenObjectToVariables(
                        item as Record<string, unknown>,
                        nodeLabel,
                        nodeId,
                        `${fieldPath}[${index}]`
                    ));
                } else {
                    // 数组元素是原始值
                    vars.push({
                        nodeLabel,
                        nodeId,
                        field: `${fieldPath}[${index}]`,
                        value: typeof item === 'string'
                            ? (item.length > 50 ? item.slice(0, 50) + '...' : item)
                            : JSON.stringify(item).slice(0, 50),
                    });
                }
            });
        } else if (value !== null && typeof value === 'object') {
            // 如果是嵌套对象，递归展开其子字段
            vars.push(...flattenObjectToVariables(
                value as Record<string, unknown>,
                nodeLabel,
                nodeId,
                fieldPath
            ));
        } else {
            // 只添加叶子节点（原始值）
            vars.push({
                nodeLabel,
                nodeId,
                field: fieldPath,
                value: typeof value === 'string'
                    ? (value.length > 50 ? value.slice(0, 50) + '...' : value)
                    : JSON.stringify(value).slice(0, 50),
            });
        }
    }
    return vars;
}
