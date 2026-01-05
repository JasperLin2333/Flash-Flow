/**
 * Tool 字段名称中文映射
 * 供 ToolDebugDialog 和 ToolNodeForm 使用
 */
export const FIELD_NAME_MAP: Record<string, string> = {
    // Web Search
    query: "搜索关键词",
    maxResults: "最大结果数",

    // Calculator
    expression: "表达式",

    // Datetime
    operation: "操作类型",
    format: "日期格式",
    date: "日期",
    targetDate: "目标日期",
    unit: "时间单位",
    amount: "数量",

    // URL Reader
    url: "网页链接",
    maxLength: "最大字符数",

    // Code Interpreter
    code: "代码",
    outputFileName: "输出文件名",
    inputFiles: "输入文件",

    // Common/Other
    city: "城市"
};

/**
 * 获取字段的中文显示名称
 * @param fieldName 字段名
 * @returns 中文名称，如果没有映射则返回原字段名
 */
export function getFieldDisplayName(fieldName: string): string {
    return FIELD_NAME_MAP[fieldName] || fieldName;
}

/**
 * 格式化字段标签（带英文字段名）
 * @param fieldName 字段名
 * @returns 格式化后的标签，如 "搜索关键词 (query)"
 */
export function formatFieldLabel(fieldName: string): string {
    const displayName = FIELD_NAME_MAP[fieldName];
    return displayName ? `${displayName} (${fieldName})` : fieldName;
}
