/**
 * Prompt 解析工具
 * 用于从 LLM Prompt 中提取变量和进行变量替换
 */

/**
 * 从 Prompt 文本中提取所有变量名
 * 支持 {{variable_name}} 格式
 * 
 * @param prompt - Prompt 文本
 * @returns 变量名数组（去重）
 * 
 * @example
 * extractVariables("你好 {{user_input}}，今天 {{date}}")
 * // => ["user_input", "date"]
 */
export function extractVariables(prompt: string): string[] {
    if (!prompt) return [];

    // 匹配 {{variable_name}} 格式
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(prompt)) !== null) {
        const variableName = match[1].trim();
        if (variableName && !matches.includes(variableName)) {
            matches.push(variableName);
        }
    }

    return matches;
}

/**
 * 转义正则表达式中的特殊字符
 * 确保变量名中的 . * + ? 等字符被正确转义
 */
export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 替换 Prompt 中的变量
 * 
 * @param prompt - Prompt 文本
 * @param values - 变量值映射
 * @param warnOnMissing - 是否警告未找到的变量（默认 true）
 * @returns 替换后的文本
 * 
 * @example
 * replaceVariables(
 *   "你好 {{name}}，你的年龄是 {{age}}",
 *   { name: "张三", age: "25" }
 * )
 * // => "你好 张三，你的年龄是 25"
 */
export function replaceVariables(
    prompt: string,
    values: Record<string, string>,
    warnOnMissing = true
): string {
    if (!prompt) return '';

    let result = prompt;
    const usedVars = new Set<string>();

    // FIX: 按 key 长度降序排序，确保 "LLM1.response" 在 "response" 之前处理
    // 这防止了短变量名意外匹配到长变量名的情况
    const sortedEntries = Object.entries(values).sort((a, b) => b[0].length - a[0].length);

    for (const [key, value] of sortedEntries) {
        // FIX: 转义正则特殊字符，防止 . 被解释为"任意字符"
        const escapedKey = escapeRegExp(key);
        const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
        if (regex.test(result)) {
            usedVars.add(key);
            // CRITICAL FIX: 重置 lastIndex，否则 replace 会从 test 结束位置开始匹配
            regex.lastIndex = 0;
        }
        result = result.replace(regex, value || '');
    }

    // FIX: 检查未替换的变量
    if (warnOnMissing) {
        const allVars = extractVariables(prompt);
        const missingVars = allVars.filter(varName => !usedVars.has(varName));
        if (missingVars.length > 0) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`[PromptParser] 未找到变量: ${missingVars.join(', ')}，已替换为空字符串`);
            }
        }
    }

    return result;
}

/**
 * 检查 Prompt 是否包含未填充的变量
 * 
 * @param prompt - Prompt 文本
 * @returns 是否包含未填充的变量
 */
export function hasUnfilledVariables(prompt: string): boolean {
    return /\{\{[^}]+\}\}/.test(prompt);
}
