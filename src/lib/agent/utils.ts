import { WorkflowZodSchema } from "@/lib/schemas/workflow";

// ============ JSON Extraction ============
// Bug #2 Fix: 使用平衡括号算法替代贪婪正则匹配
export function extractBalancedJson(text: string): string | null {
    // 查找包含 "nodes" 的 JSON 对象起始位置 (Case-insensitive)
    let nodesIndex = text.indexOf('"nodes"');
    if (nodesIndex === -1) {
        nodesIndex = text.indexOf('"Nodes"');
    }
    if (nodesIndex === -1) return null;

    // 向前搜索最近的 '{'
    let startIndex = -1;
    for (let i = nodesIndex - 1; i >= 0; i--) {
        if (text[i] === '{') {
            startIndex = i;
            break;
        }
    }
    if (startIndex === -1) return null;

    // 从 startIndex 开始使用平衡括号算法
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\' && inString) {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
                depth--;
                if (depth === 0) {
                    const jsonStr = text.slice(startIndex, i + 1);
                    // 验证提取的 JSON 包含必需字段 (Case-insensitive)
                    const lowerJson = jsonStr.toLowerCase();
                    if (lowerJson.includes('"nodes"') && lowerJson.includes('"edges"')) {
                        return jsonStr;
                    }
                    return null;
                }
            }
        }
    }

    return null; // 未找到平衡的 JSON
}

// ============ Validation ============
import { healVariables } from "./variableHealer";
import { healStructure } from "./structureHealer";

// Updated Interface - 支持三层修复
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    softPass: boolean;
    fixedNodes?: any[];   // 修复后的节点
    fixedEdges?: any[];   // 修复后的边（结构自愈）
    warnings?: string[];  // 自动修复日志
}

// ============ Validation ============
// 三层渐进式验证与自愈：Schema → 结构 → 变量
export function validateWorkflow(nodes: unknown[], edges: unknown[]): ValidationResult {
    const allWarnings: string[] = [];

    // ========== 第 0 层：基础检查 ==========
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return { valid: false, errors: ["No nodes generated"], softPass: false };
    }

    // ========== 第 1 层：Zod Schema 验证 ==========
    try {
        WorkflowZodSchema.parse({ nodes, edges });
    } catch (error) {
        const zodError = error as { errors?: Array<{ message: string; path?: (string | number)[] }> };
        const errors = zodError.errors?.map(e => `Schema Error: ${e.path?.join('.')}: ${e.message}`) || ["Unknown validation error"];
        // Schema 错误无法自愈，必须重试
        return { valid: false, errors, softPass: false };
    }

    // ========== 第 2 层：结构自愈（循环依赖、孤岛节点）==========
    const structureResult = healStructure(nodes as any[], edges as any[]);
    allWarnings.push(...structureResult.fixes);

    // 如果结构自愈仍有错误（理论上不应该发生）
    if (structureResult.errors.length > 0) {
        return {
            valid: false,
            errors: structureResult.errors,
            softPass: false
        };
    }

    // 使用修复后的节点和边进行后续验证
    const healedNodes = structureResult.fixedNodes;
    const healedEdges = structureResult.fixedEdges;

    // ========== 第 3 层：变量自愈 ==========
    const variableResult = healVariables(healedNodes);
    allWarnings.push(...variableResult.fixes);

    if (variableResult.errors.length > 0) {
        // 变量错误无法自动修复，返回智能建议
        return {
            valid: false,
            errors: variableResult.errors,
            softPass: false,
            fixedNodes: variableResult.fixedNodes,    // 保留（可能包含部分修复的）节点
            fixedEdges: healedEdges,    // 保留结构自愈后的边
            warnings: allWarnings       // 保留已产生的修复日志
        };
    }

    // ========== 全部通过 ==========
    return {
        valid: true,
        errors: [],
        softPass: true,
        fixedNodes: variableResult.fixedNodes,
        fixedEdges: healedEdges,
        warnings: allWarnings
    };
}
