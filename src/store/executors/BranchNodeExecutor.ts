import type { AppNode, FlowContext, BranchNodeData } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { getUpstreamData } from "./contextUtils";
import { useFlowStore } from "@/store/flowStore";
import { buildGlobalNodeLookupMap } from "./utils/variableUtils";
import {
    NODE_PATH_PATTERN,
    INCLUDES_PATTERN,
    STARTS_WITH_PATTERN,
    ENDS_WITH_PATTERN,
    STRICT_EQUAL_PATTERN,
    NOT_EQUAL_PATTERN,
    COMPARISON_PATTERN,
    CONSTANT_BOOL_PATTERN,
    LITERAL_COMPARE_PATTERN,
    LITERAL_EQUAL_PATTERN,
    LITERAL_NOT_EQUAL_PATTERN,
    parseCompareValue,
    getNestedValue,
} from "@/lib/branchConditionParser";

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
