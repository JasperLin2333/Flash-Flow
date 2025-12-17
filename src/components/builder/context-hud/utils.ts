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
 * 检查对象是否为"文件对象"（包含 name 和 url 字段）
 * 文件对象不应被展开，而是作为单一变量显示
 */
function isFileObject(obj: Record<string, unknown>): boolean {
    return typeof obj.name === 'string' && typeof obj.url === 'string';
}

/**
 * 递归展开嵌套对象为可引用的变量列表
 * - 文件对象（包含 name 和 url）不展开，作为单一变量显示
 * - 其他嵌套对象展开为叶子节点
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
            const objValue = value as Record<string, unknown>;

            // 检查是否为文件对象（包含 name 和 url），不展开
            if (isFileObject(objValue)) {
                vars.push({
                    nodeLabel,
                    nodeId,
                    field: fieldPath,
                    value: `📎 ${objValue.name}`,
                });
            } else {
                // 其他嵌套对象，递归展开其子字段
                vars.push(...flattenObjectToVariables(
                    objValue,
                    nodeLabel,
                    nodeId,
                    fieldPath
                ));
            }
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
