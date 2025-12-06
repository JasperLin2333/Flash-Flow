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

    for (const [key, value] of Object.entries(values)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        if (regex.test(result)) {
            usedVars.add(key);
        }
        result = result.replace(regex, value || '');
    }

    // FIX: 检查未替换的变量
    if (warnOnMissing) {
        const allVars = extractVariables(prompt);
        const missingVars = allVars.filter(varName => !usedVars.has(varName));
        if (missingVars.length > 0) {
            console.warn(`[PromptParser] 未找到变量: ${missingVars.join(', ')}，已替换为空字符串`);
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
