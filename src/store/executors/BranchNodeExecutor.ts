import type { AppNode, FlowContext, BranchNodeData } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { getUpstreamData } from "./contextUtils";
import { useFlowStore } from "@/store/flowStore";
import { buildGlobalNodeLookupMap } from "./utils/variableUtils";

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
 * (已废弃，使用公共的 buildGlobalNodeLookupMap 代替)
 * 构建节点查找 Map，用于 O(1) 查找
 * Map key 可以是 nodeId 或 label（支持大小写不敏感）
 */
// 保留旧函数以便向后兼容，但实际上已经不再使用

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
function safeEvaluateCondition(
    condition: string,
    context: FlowContext,
    lookupMap: Map<string, unknown>
): boolean {
    if (!condition) return false;

    const trimmed = condition.trim();

    // ===== 逻辑运算符处理 (递归求值) =====
    // 优先处理 OR (||)，因为 OR 优先级低于 AND
    // 使用 ' || ' 带空格避免误匹配字符串中的 ||
    if (trimmed.includes(' || ')) {
        const parts = trimmed.split(' || ').map(p => p.trim()).filter(p => p);
        if (parts.length > 1) {
            return parts.some(part => safeEvaluateCondition(part, context, lookupMap));
        }
    }

    // 处理 AND (&&)
    // 使用 ' && ' 带空格避免误匹配字符串中的 &&
    if (trimmed.includes(' && ')) {
        const parts = trimmed.split(' && ').map(p => p.trim()).filter(p => p);
        if (parts.length > 1) {
            return parts.every(part => safeEvaluateCondition(part, context, lookupMap));
        }
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
                    condition: condition || '',
                    conditionResult: true,
                    ...(typeof upstreamData === 'object' ? upstreamData : { value: upstreamData })
                };
            }

            // 使用公共函数构建全局节点查找 Map（支持引用任意已执行节点）
            const { nodes: allNodes, flowContext: globalFlowContext } = useFlowStore.getState();
            const lookupMap = buildGlobalNodeLookupMap(context, globalFlowContext, allNodes);

            // 使用安全表达式求值器
            const conditionResult = safeEvaluateCondition(condition, context, lookupMap);

            // FIX P2: 透传上游节点的数据时，过滤敏感字段（如 _meta）
            const filteredData = typeof upstreamData === 'object' && upstreamData !== null
                ? Object.fromEntries(
                    Object.entries(upstreamData).filter(([key]) => !key.startsWith('_'))
                )
                : { value: upstreamData };

            // 透传过滤后的上游节点数据，并附加 conditionResult
            return {
                passed: true,
                condition,
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
