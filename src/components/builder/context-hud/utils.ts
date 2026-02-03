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
 * 不应被展开的聚合字段名列表
 * 这些字段会作为整体显示，用户可通过 .subfield 手动引用子字段
 */
const AGGREGATE_FIELDS = new Set(['usage']);

/**
 * 检查字段是否为聚合字段（不应展开）
 */
function isAggregateField(fieldName: string): boolean {
    return AGGREGATE_FIELDS.has(fieldName);
}

/**
 * 递归展开嵌套对象为可引用的变量列表
 * - 文件对象（包含 name 和 url）不展开，作为单一变量显示
 * - 其他嵌套对象展开为叶子节点
 * - maxDepth 限制展开深度（超过深度的对象作为整体显示）
 * 例如：{ formData: { destination: "巴黎", date: "2025-01-01" } } 
 * 会生成变量：formData.destination, formData.date（不包含 formData 本身）
 */
export function flattenObjectToVariables(
    obj: Record<string, unknown>,
    nodeLabel: string,
    nodeId: string,
    prefix: string = "",
    maxDepth: number = 2,
    currentDepth: number = 0
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

            // 2. 如果深度允许，展开每个元素的属性
            if (currentDepth < maxDepth) {
                value.forEach((item, index) => {
                    if (item !== null && typeof item === 'object') {
                        // 对数组中的每个对象，展开其属性
                        vars.push(...flattenObjectToVariables(
                            item as Record<string, unknown>,
                            nodeLabel,
                            nodeId,
                            `${fieldPath}[${index}]`,
                            maxDepth,
                            currentDepth + 1
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
            }
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
            } else if (isAggregateField(key)) {
                // 聚合字段（如 usage），作为整体显示，提示用户可动态获取
                vars.push({
                    nodeLabel,
                    nodeId,
                    field: fieldPath,
                    value: `动态获取 (可用 .${Object.keys(objValue).slice(0, 3).join(', .')} 等)`,
                });
            } else if (currentDepth >= maxDepth) {
                // 达到最大深度，作为整体显示
                vars.push({
                    nodeLabel,
                    nodeId,
                    field: fieldPath,
                    value: `对象 (${Object.keys(objValue).length} 字段)`,
                });
            } else {
                // 其他嵌套对象，递归展开其子字段
                vars.push(...flattenObjectToVariables(
                    objValue,
                    nodeLabel,
                    nodeId,
                    fieldPath,
                    maxDepth,
                    currentDepth + 1
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

export function flattenToolNodeOutput(
    output: Record<string, unknown>,
    nodeLabel: string,
    nodeId: string,
    toolType?: string
): UpstreamVariable[] {
    if (toolType === "web_search") {
        const vars: UpstreamVariable[] = [];

        const contentRaw = output.content;
        const content = typeof contentRaw === "string" ? contentRaw : "";
        if (content.trim().length > 0) {
            vars.push({
                nodeLabel,
                nodeId,
                field: "content",
                value: content.length > 80 ? `${content.slice(0, 80)}...` : content,
            });
        } else {
            const results = output.results;
            if (Array.isArray(results)) {
                vars.push({
                    nodeLabel,
                    nodeId,
                    field: "results",
                    value: `搜索结果 (${results.length} 项)`,
                });
            }
        }

        const countRaw = output.count;
        if (typeof countRaw === "number") {
            vars.push({
                nodeLabel,
                nodeId,
                field: "count",
                value: String(countRaw),
            });
        }

        return vars;
    }

    return flattenObjectToVariables(output, nodeLabel, nodeId);
}

/**
 * Input 节点专用的简化展开函数
 * 只生成简洁的变量列表，不递归展开嵌套属性
 * 
 * 输出变量：
 * - user_input: 用户输入文本（如果启用）
 * - files: 文件数组整体（如果启用且有文件）
 * - files[n]: 单个文件对象占位符（便于用户引用）
 * - formData.字段标签: 表单字段值（如果启用）
 */
export function flattenInputNodeOutput(
    output: Record<string, unknown>,
    nodeLabel: string,
    nodeId: string,
    nodeData: Record<string, unknown>
): UpstreamVariable[] {
    const vars: UpstreamVariable[] = [];

    // 1. user_input - 如果启用了文本输入
    const enableTextInput = nodeData?.enableTextInput !== false; // 默认 true
    if (enableTextInput && 'user_input' in output) {
        const text = output.user_input as string;
        vars.push({
            nodeLabel,
            nodeId,
            field: 'user_input',
            value: typeof text === 'string'
                ? (text.length > 30 ? text.slice(0, 30) + '...' : text)
                : String(text),
        });
    }

    // 2. files - 如果启用了文件输入
    const enableFileInput = nodeData?.enableFileInput === true;
    if (enableFileInput && output.files) {
        const files = output.files as unknown[];
        if (files.length > 0) {
            vars.push({
                nodeLabel,
                nodeId,
                field: 'files',
                value: `全部附件 (${files.length} 项)`,
            });
            vars.push({
                nodeLabel,
                nodeId,
                field: 'files[n]',
                value: '单个附件对象',
            });
        }
    }

    // 3. formData.字段标签 - 如果启用了结构化表单
    const enableStructuredForm = nodeData?.enableStructuredForm === true;
    const formFields = nodeData?.formFields as Array<{ name: string; label: string }> | undefined;
    if (enableStructuredForm && output.formData && formFields && formFields.length > 0) {
        const formData = output.formData as Record<string, unknown>;
        formFields.forEach(field => {
            // 使用 label 作为显示字段名（用户友好）
            const fieldValue = formData[field.name];
            let displayValue = '';
            if (Array.isArray(fieldValue)) {
                displayValue = fieldValue.join(', ');
            } else if (fieldValue !== undefined && fieldValue !== null) {
                displayValue = String(fieldValue);
            }
            vars.push({
                nodeLabel,
                nodeId,
                field: `formData.${field.label}`,
                value: displayValue.length > 30 ? displayValue.slice(0, 30) + '...' : displayValue,
            });
        });
    }

    return vars;
}
