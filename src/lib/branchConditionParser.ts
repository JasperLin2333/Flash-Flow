/**
 * 共享的 Branch 条件表达式解析模块
 * 供 BranchNodeExecutor 和 BranchNodeForm 共同使用
 */

import type { FlowContext } from "@/types/flow";

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
 * 移除条件表达式中的 {{ 和 }} 包裹符号
 * 允许用户写 {{Node.Field}} 或 Node.Field
 */
export function cleanCondition(condition: string): string {
    if (!condition) return condition;
    // 移除所有 {{ 和 }}
    return condition.replace(/\{\{/g, '').replace(/\}\}/g, '');
}

function splitByLogicalOperator(input: string, operator: "||" | "&&"): string[] {
    const parts: string[] = [];
    let buf = "";
    let quote: "'" | '"' | null = null;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];

        if (quote) {
            buf += ch;
            if (ch === quote && input[i - 1] !== "\\") {
                quote = null;
            }
            continue;
        }

        if (ch === "'" || ch === '"') {
            quote = ch;
            buf += ch;
            continue;
        }

        if (ch === operator[0] && input[i + 1] === operator[1]) {
            parts.push(buf);
            buf = "";
            i += 1;
            continue;
        }

        buf += ch;
    }

    parts.push(buf);
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

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

    // 预处理：移除 {{}}
    const trimmed = cleanCondition(condition).trim();

    // Split by || first (lower precedence)
    {
        const parts = splitByLogicalOperator(trimmed, "||");
        if (parts.length > 1) {
            for (const part of parts) {
                const result = validateCondition(part);
                if (!result.valid) return result;
            }
            return { valid: true };
        }
    }

    // Split by && 
    {
        const parts = splitByLogicalOperator(trimmed, "&&");
        if (parts.length > 1) {
            for (const part of parts) {
                const result = validateCondition(part);
                if (!result.valid) return result;
            }
            return { valid: true };
        }
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

/**
 * 安全表达式求值器
 * 只允许特定的操作，防止代码注入攻击
 * 
 * 支持引用任意已执行节点的输出（不限于直连上游）
 * 
 * 支持的表达式格式 (nodeName 为节点名称):
 * - nodeName.response.includes('关键词')
 * - nodeName.text.startsWith('前缀')
 * - nodeName.text.endsWith('后缀')
 * - nodeName.score > 60
 * - nodeName.value >= 100
 * - nodeName.count < 10
 * - nodeName.amount <= 50
 * - nodeName.status === 'active'
 * - nodeName.status !== 'deleted'
 * - nodeName.text.length > 5
 * 
 * 逻辑组合支持:
 * - 条件1 && 条件2 (AND 逻辑)
 * - 条件1 || 条件2 (OR 逻辑)
 */
export function safeEvaluateCondition(
    condition: string,
    context: FlowContext,
    lookupMap: Map<string, unknown>
): boolean {
    if (!condition) return false;

    // 预处理：移除 {{}}
    const trimmed = cleanCondition(condition).trim();

    // ===== 逻辑运算符处理 (递归求值) =====
    // 优先处理 OR (||)，因为 OR 优先级低于 AND
    {
        const parts = splitByLogicalOperator(trimmed, "||");
        if (parts.length > 1) return parts.some((part) => safeEvaluateCondition(part, context, lookupMap));
    }

    // 处理 AND (&&)
    {
        const parts = splitByLogicalOperator(trimmed, "&&");
        if (parts.length > 1) return parts.every((part) => safeEvaluateCondition(part, context, lookupMap));
    }

    // ===== 单一条件求值 =====
    // lookupMap 已经在外部构建好，直接使用

    // 使用 lookup map 进行 O(1) 查找
    const extractNodeAndPath = (expr: string): { nodeData: unknown; path: string } | null => {
        const match = expr.match(NODE_PATH_PATTERN);
        if (!match) return null;

        const nodeName = match[1];
        const path = match[2];

        // O(1) lookup: try exact match first, then lowercase
        const nodeData = lookupMap.get(nodeName) ?? lookupMap.get(nodeName.toLowerCase());
        if (nodeData) {
            return { nodeData, path };
        }

        return null;
    };

    // Pattern 1: nodeName.xxx.includes('yyy')
    const includesMatch = trimmed.match(INCLUDES_PATTERN);
    if (includesMatch) {
        const extracted = extractNodeAndPath(includesMatch[1]);
        if (!extracted) return false;
        const searchStr = includesMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        return typeof value === 'string' && value.includes(searchStr);
    }

    // Pattern 2: nodeName.xxx.startsWith('yyy')
    const startsWithMatch = trimmed.match(STARTS_WITH_PATTERN);
    if (startsWithMatch) {
        const extracted = extractNodeAndPath(startsWithMatch[1]);
        if (!extracted) return false;
        const searchStr = startsWithMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        return typeof value === 'string' && value.startsWith(searchStr);
    }

    // Pattern 3: nodeName.xxx.endsWith('yyy')
    const endsWithMatch = trimmed.match(ENDS_WITH_PATTERN);
    if (endsWithMatch) {
        const extracted = extractNodeAndPath(endsWithMatch[1]);
        if (!extracted) return false;
        const searchStr = endsWithMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        return typeof value === 'string' && value.endsWith(searchStr);
    }

    // Pattern 4: nodeName.xxx === 'yyy' or nodeName.xxx === 123
    const strictEqualMatch = trimmed.match(STRICT_EQUAL_PATTERN);
    if (strictEqualMatch) {
        const extracted = extractNodeAndPath(strictEqualMatch[1]);
        if (!extracted) return false;
        const compareValueRaw = strictEqualMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        const compareValue = parseCompareValue(compareValueRaw);
        return value === compareValue;
    }

    // Pattern 5: nodeName.xxx !== 'yyy'
    const notEqualMatch = trimmed.match(NOT_EQUAL_PATTERN);
    if (notEqualMatch) {
        const extracted = extractNodeAndPath(notEqualMatch[1]);
        if (!extracted) return false;
        const compareValueRaw = notEqualMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        const compareValue = parseCompareValue(compareValueRaw);
        return value !== compareValue;
    }

    // Pattern 6: nodeName.xxx > 123 (or >=, <, <=)
    const comparisonMatch = trimmed.match(COMPARISON_PATTERN);
    if (comparisonMatch) {
        const extracted = extractNodeAndPath(comparisonMatch[1]);
        if (!extracted) return false;
        const operator = comparisonMatch[2];
        const compareNum = parseFloat(comparisonMatch[3]);
        const value = getNestedValue(extracted.nodeData, extracted.path);
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));

        if (isNaN(numValue) || isNaN(compareNum)) return false;

        switch (operator) {
            case '>': return numValue > compareNum;
            case '>=': return numValue >= compareNum;
            case '<': return numValue < compareNum;
            case '<=': return numValue <= compareNum;
            default: return false;
        }
    }

    // Pattern 7: Literal Equality (1 === 1, 'a' === 'a', true === true)
    const literalEqualMatch = trimmed.match(LITERAL_EQUAL_PATTERN);
    if (literalEqualMatch) {
        const left = parseCompareValue(literalEqualMatch[1]);
        const right = parseCompareValue(literalEqualMatch[2]);
        return left === right;
    }

    // Pattern 8: Literal Inequality
    const literalNotEqualMatch = trimmed.match(LITERAL_NOT_EQUAL_PATTERN);
    if (literalNotEqualMatch) {
        const left = parseCompareValue(literalNotEqualMatch[1]);
        const right = parseCompareValue(literalNotEqualMatch[2]);
        return left !== right;
    }

    // Pattern 9: Literal Comparison (1 > 2)
    const literalCompareMatch = trimmed.match(LITERAL_COMPARE_PATTERN);
    if (literalCompareMatch) {
        const left = parseFloat(literalCompareMatch[1]);
        const operator = literalCompareMatch[2];
        const right = parseFloat(literalCompareMatch[3]);

        if (isNaN(left) || isNaN(right)) return false;

        switch (operator) {
            case '>': return left > right;
            case '>=': return left >= right;
            case '<': return left < right;
            case '<=': return left <= right;
            default: return false;
        }
    }

    // Pattern 10: Constant Boolean
    if (CONSTANT_BOOL_PATTERN.test(trimmed)) {
        return trimmed === 'true';
    }

    // 不支持的表达式格式
    console.warn(`[BranchNodeExecutor] Unsupported condition format: ${condition}`);
    console.warn('[BranchNodeExecutor] Supported formats: nodeName.x.includes("y"), nodeName.x > 5, nodeName.x === "value"');
    return false;
}
