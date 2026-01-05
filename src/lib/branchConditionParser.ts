/**
 * 共享的 Branch 条件表达式解析模块
 * 供 BranchNodeExecutor 和 BranchNodeForm 共同使用
 */

// ============ Pre-compiled Regex Patterns ============
// Pre-compile at module level to avoid recreation on each call

export const NODE_PATH_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*)\.([\w.]+)/;
export const INCLUDES_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.includes\(['"](.+)['"]\)$/;
export const STARTS_WITH_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.startsWith\(['"](.+)['"]\)$/;
export const ENDS_WITH_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.endsWith\(['"](.+)['"]\)$/;
export const STRICT_EQUAL_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*===\s*['"]?(.+?)['"]?$/;
export const NOT_EQUAL_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*!==\s*['"]?(.+?)['"]?$/;
export const COMPARISON_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*(>=|<=|>|<)\s*(-?\d+\.?\d*)$/;

// Literal / Constant Patterns
export const CONSTANT_BOOL_PATTERN = /^(true|false)$/;
export const LITERAL_COMPARE_PATTERN = /^(-?\d+\.?\d*)\s*(>=|<=|>|<)\s*(-?\d+\.?\d*)$/;
// Matches "left === right" where left/right can be anything (parsed later)
export const LITERAL_EQUAL_PATTERN = /^(.+?)\s*===\s*(.+?)$/;
export const LITERAL_NOT_EQUAL_PATTERN = /^(.+?)\s*!==\s*(.+?)$/;

/**
 * 验证单个条件表达式是否符合白名单格式
 */
export function isValidSingleCondition(expr: string): boolean {
    const trimmed = expr.trim();
    if (!trimmed) return true; // Empty is valid (defaults to true)

    return (
        INCLUDES_PATTERN.test(trimmed) ||
        STARTS_WITH_PATTERN.test(trimmed) ||
        ENDS_WITH_PATTERN.test(trimmed) ||
        STRICT_EQUAL_PATTERN.test(trimmed) ||
        NOT_EQUAL_PATTERN.test(trimmed) ||
        COMPARISON_PATTERN.test(trimmed) ||
        CONSTANT_BOOL_PATTERN.test(trimmed) ||
        LITERAL_COMPARE_PATTERN.test(trimmed) ||
        LITERAL_EQUAL_PATTERN.test(trimmed) ||
        LITERAL_NOT_EQUAL_PATTERN.test(trimmed)
    );
}

/**
 * 验证条件表达式（支持 && 和 || 运算符）
 * @returns { valid: boolean, error?: string }
 */
export function validateCondition(condition: string): { valid: boolean; error?: string } {
    if (!condition || !condition.trim()) {
        return { valid: true }; // Empty is valid
    }

    const trimmed = condition.trim();

    // Split by || first (lower precedence)
    if (trimmed.includes(' || ')) {
        const parts = trimmed.split(' || ').map(p => p.trim()).filter(p => p);
        for (const part of parts) {
            const result = validateCondition(part);
            if (!result.valid) return result;
        }
        return { valid: true };
    }

    // Split by && 
    if (trimmed.includes(' && ')) {
        const parts = trimmed.split(' && ').map(p => p.trim()).filter(p => p);
        for (const part of parts) {
            const result = validateCondition(part);
            if (!result.valid) return result;
        }
        return { valid: true };
    }

    // Single condition
    if (!isValidSingleCondition(trimmed)) {
        return {
            valid: false,
            error: `不支持的格式: "${trimmed.length > 30 ? trimmed.slice(0, 27) + '...' : trimmed}"`
        };
    }

    return { valid: true };
}

/**
 * 解析比较值，处理字符串引号和数字
 */
export function parseCompareValue(raw: string): string | number | boolean {
    const trimmed = raw.trim();

    // 布尔值
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // 数字
    if (/^-?\d+\.?\d*$/.test(trimmed)) {
        return parseFloat(trimmed);
    }

    // 字符串 (去除引号)
    return trimmed.replace(/^['"]|['"]$/g, '');
}

/**
 * 安全地获取嵌套对象属性值
 * 例如: getNestedValue(obj, 'response.text') -> obj.response.text
 */
export function getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}
