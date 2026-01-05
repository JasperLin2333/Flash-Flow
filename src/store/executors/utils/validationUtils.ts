/**
 * Validation Utilities
 * 
 * Shared validation functions for node executors and API routes.
 */

/**
 * 检查值是否为有效的图片 URL 或 base64
 * 
 * 验证规则:
 * 1. 值不能为空或仅空白字符
 * 2. 值不能包含未解析的变量占位符 (如 {{variable}})
 * 
 * @param value - 待验证的字符串值
 * @returns 如果值有效返回 true，否则返回 false
 */
export function isValidImageValue(value: string | undefined): boolean {
    if (!value || value.trim().length === 0) return false;
    // Reject unresolved variable placeholders like {{variable}}
    if (/\{\{[^}]+\}\}/.test(value)) return false;
    return true;
}
