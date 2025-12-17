import type { AppNode, FlowContext, BranchNodeData } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { getUpstreamData } from "./contextUtils";

// ============ Pre-compiled Regex Patterns ============
// Pre-compile at module level to avoid recreation on each call
const NODE_PATH_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*)\.([\w.]+)/;
const INCLUDES_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.includes\(['"](.+)['"]\)$/;
const STARTS_WITH_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.startsWith\(['"](.+)['"]\)$/;
const ENDS_WITH_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.endsWith\(['"](.+)['"]\)$/;
const STRICT_EQUAL_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*===\s*['"]?(.+?)['"]?$/;
const NOT_EQUAL_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*!==\s*['"]?(.+?)['"]?$/;
const COMPARISON_PATTERN = /^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*(>=|<=|>|<)\s*(-?\d+\.?\d*)$/;

/**
 * 构建节点查找 Map，用于 O(1) 查找
 * Map key 可以是 nodeId 或 label（支持大小写不敏感）
 */
function buildNodeLookupMap(context: FlowContext): Map<string, unknown> {
    const lookupMap = new Map<string, unknown>();
    const meta = context._meta as Record<string, unknown> | undefined;
    const nodeLabels = (meta?.nodeLabels as Record<string, string>) || {};

    for (const [nodeId, nodeOutput] of Object.entries(context)) {
        if (nodeId.startsWith('_')) continue;
        if (typeof nodeOutput !== 'object' || nodeOutput === null) continue;

        // Add by nodeId (exact and lowercase)
        lookupMap.set(nodeId, nodeOutput);
        lookupMap.set(nodeId.toLowerCase(), nodeOutput);

        // Add by label if available
        const label = nodeLabels[nodeId];
        if (label) {
            lookupMap.set(label, nodeOutput);
            lookupMap.set(label.toLowerCase(), nodeOutput);
        }
    }

    return lookupMap;
}

/**
 * 安全表达式求值器
 * 只允许特定的操作，防止代码注入攻击
 * 
 * 支持的表达式格式 (nodeName 为上游节点名称):
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
 */
function safeEvaluateCondition(condition: string, context: FlowContext): boolean {
    if (!condition) return false;

    const trimmed = condition.trim();

    // Build lookup map once per evaluation (O(n) build, then O(1) lookups)
    const lookupMap = buildNodeLookupMap(context);

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

    // 不支持的表达式格式
    console.warn(`[BranchNodeExecutor] Unsupported condition format: ${condition}`);
    console.warn('[BranchNodeExecutor] Supported formats: nodeName.x.includes("y"), nodeName.x > 5, nodeName.x === "value"');
    return false;
}

/**
 * 安全地获取嵌套对象属性值
 * 例如: getNestedValue(obj, 'response.text') -> obj.response.text
 */
function getNestedValue(obj: unknown, path: string): unknown {
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
 * 解析比较值，处理字符串引号和数字
 */
function parseCompareValue(raw: string): string | number | boolean {
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
 * Branch 节点执行器
 * 
 * 执行逻辑：
 * 1. 获取上游数据
 * 2. 使用安全表达式求值器评估条件
 * 3. 返回 { conditionResult: boolean, ...upstreamData }
 */
export class BranchNodeExecutor extends BaseNodeExecutor {
    async execute(
        node: AppNode,
        context: FlowContext,
        _mockData?: Record<string, unknown>
    ): Promise<ExecutionResult> {
        const { result, time } = await this.measureTime(async () => {
            // 使用共享工具函数获取上游数据
            const upstreamData = getUpstreamData(context);
            const data = node.data as BranchNodeData;
            const condition = data.condition;

            // 如果没有配置条件，默认为 true 以保持连通性
            if (!condition || !condition.trim()) {
                return {
                    passed: true,
                    conditionResult: true,
                    ...(typeof upstreamData === 'object' ? upstreamData : { value: upstreamData })
                };
            }

            // 使用安全表达式求值器（传入完整 context 以支持节点名称解析）
            const conditionResult = safeEvaluateCondition(condition, context);

            // FIX P2: 透传上游节点的数据时，过滤敏感字段（如 _meta）
            const filteredData = typeof upstreamData === 'object' && upstreamData !== null
                ? Object.fromEntries(
                    Object.entries(upstreamData).filter(([key]) => !key.startsWith('_'))
                )
                : { value: upstreamData };

            // 透传过滤后的上游节点数据，并附加 conditionResult
            return {
                passed: true,
                conditionResult,
                ...filteredData
            };
        });

        return {
            output: result as Record<string, unknown>,
            executionTime: time
        };
    }
}
