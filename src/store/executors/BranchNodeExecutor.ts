import type { AppNode, FlowContext, BranchNodeData } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { getUpstreamData } from "./contextUtils";

/**
 * 安全表达式求值器
 * 只允许特定的操作，防止代码注入攻击
 * 
 * 支持的表达式格式:
 * - input.response.includes('关键词')
 * - input.text.startsWith('前缀')
 * - input.text.endsWith('后缀')
 * - input.score > 60
 * - input.value >= 100
 * - input.count < 10
 * - input.amount <= 50
 * - input.status === 'active'
 * - input.status !== 'deleted'
 * - input.text.length > 5
 */
function safeEvaluateCondition(condition: string, input: unknown): boolean {
    if (!condition || !input) return false;

    const trimmed = condition.trim();

    // Pattern 1: input.xxx.includes('yyy')
    const includesMatch = trimmed.match(/^input\.(\w+(?:\.\w+)*)\.includes\(['"](.+)['"]\)$/);
    if (includesMatch) {
        const path = includesMatch[1];
        const searchStr = includesMatch[2];
        const value = getNestedValue(input, path);
        return typeof value === 'string' && value.includes(searchStr);
    }

    // Pattern 2: input.xxx.startsWith('yyy')
    const startsWithMatch = trimmed.match(/^input\.(\w+(?:\.\w+)*)\.startsWith\(['"](.+)['"]\)$/);
    if (startsWithMatch) {
        const path = startsWithMatch[1];
        const searchStr = startsWithMatch[2];
        const value = getNestedValue(input, path);
        return typeof value === 'string' && value.startsWith(searchStr);
    }

    // Pattern 3: input.xxx.endsWith('yyy')
    const endsWithMatch = trimmed.match(/^input\.(\w+(?:\.\w+)*)\.endsWith\(['"](.+)['"]\)$/);
    if (endsWithMatch) {
        const path = endsWithMatch[1];
        const searchStr = endsWithMatch[2];
        const value = getNestedValue(input, path);
        return typeof value === 'string' && value.endsWith(searchStr);
    }

    // Pattern 4: input.xxx === 'yyy' or input.xxx === 123
    const strictEqualMatch = trimmed.match(/^input\.(\w+(?:\.\w+)*)\s*===\s*['"]?(.+?)['"]?$/);
    if (strictEqualMatch) {
        const path = strictEqualMatch[1];
        const compareValueRaw = strictEqualMatch[2];
        const value = getNestedValue(input, path);
        const compareValue = parseCompareValue(compareValueRaw);
        return value === compareValue;
    }

    // Pattern 5: input.xxx !== 'yyy'
    const notEqualMatch = trimmed.match(/^input\.(\w+(?:\.\w+)*)\s*!==\s*['"]?(.+?)['"]?$/);
    if (notEqualMatch) {
        const path = notEqualMatch[1];
        const compareValueRaw = notEqualMatch[2];
        const value = getNestedValue(input, path);
        const compareValue = parseCompareValue(compareValueRaw);
        return value !== compareValue;
    }

    // Pattern 6: input.xxx > 123 (or >=, <, <=)
    const comparisonMatch = trimmed.match(/^input\.(\w+(?:\.\w+)*)\s*(>=|<=|>|<)\s*(-?\d+\.?\d*)$/);
    if (comparisonMatch) {
        const path = comparisonMatch[1];
        const operator = comparisonMatch[2];
        const compareNum = parseFloat(comparisonMatch[3]);
        const value = getNestedValue(input, path);
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
    console.warn('[BranchNodeExecutor] Supported formats: input.x.includes("y"), input.x > 5, input.x === "value"');
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

            // 使用安全表达式求值器
            const conditionResult = safeEvaluateCondition(condition, upstreamData);

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
