import type { AppNode, FlowContext, BranchNodeData } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { getUpstreamData } from "./contextUtils";

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

    // 通用模式: 提取 nodeName.path 格式
    // Pattern: nodeName.path.method('arg') or nodeName.path op value
    const extractNodeAndPath = (expr: string): { nodeData: unknown; path: string } | null => {
        // 匹配 nodeName.path 格式 (nodeName 可以是中文或英文)
        const match = expr.match(/^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*)\.([\w.]+)/);
        if (!match) return null;

        const nodeName = match[1];
        const path = match[2];

        // 在 context 中查找匹配的节点（按 label 或 nodeId 匹配）
        for (const [nodeId, nodeOutput] of Object.entries(context)) {
            if (nodeId.startsWith('_')) continue; // 跳过 _meta 等内部字段

            // 检查 nodeOutput 中是否有 label 字段与 nodeName 匹配
            if (typeof nodeOutput === 'object' && nodeOutput !== null) {
                const output = nodeOutput as Record<string, unknown>;
                // 直接匹配 nodeId（如 input_1, llm_1）或节点 label
                if (nodeId === nodeName || nodeId.toLowerCase() === nodeName.toLowerCase()) {
                    return { nodeData: output, path };
                }
            }
        }

        // 如果没找到，尝试从 _meta 中按 label 查找
        const meta = context._meta as Record<string, unknown> | undefined;
        if (meta?.nodeLabels) {
            const nodeLabels = meta.nodeLabels as Record<string, string>;
            for (const [nodeId, label] of Object.entries(nodeLabels)) {
                if (label === nodeName || label.toLowerCase() === nodeName.toLowerCase()) {
                    const nodeOutput = context[nodeId];
                    if (nodeOutput && typeof nodeOutput === 'object') {
                        return { nodeData: nodeOutput, path };
                    }
                }
            }
        }

        return null;
    };

    // Pattern 1: nodeName.xxx.includes('yyy')
    const includesMatch = trimmed.match(/^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.includes\(['"](.+)['"]\)$/);
    if (includesMatch) {
        const extracted = extractNodeAndPath(includesMatch[1]);
        if (!extracted) return false;
        const searchStr = includesMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        return typeof value === 'string' && value.includes(searchStr);
    }

    // Pattern 2: nodeName.xxx.startsWith('yyy')
    const startsWithMatch = trimmed.match(/^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.startsWith\(['"](.+)['"]\)$/);
    if (startsWithMatch) {
        const extracted = extractNodeAndPath(startsWithMatch[1]);
        if (!extracted) return false;
        const searchStr = startsWithMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        return typeof value === 'string' && value.startsWith(searchStr);
    }

    // Pattern 3: nodeName.xxx.endsWith('yyy')
    const endsWithMatch = trimmed.match(/^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\.endsWith\(['"](.+)['"]\)$/);
    if (endsWithMatch) {
        const extracted = extractNodeAndPath(endsWithMatch[1]);
        if (!extracted) return false;
        const searchStr = endsWithMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        return typeof value === 'string' && value.endsWith(searchStr);
    }

    // Pattern 4: nodeName.xxx === 'yyy' or nodeName.xxx === 123
    const strictEqualMatch = trimmed.match(/^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*===\s*['"]?(.+?)['"]?$/);
    if (strictEqualMatch) {
        const extracted = extractNodeAndPath(strictEqualMatch[1]);
        if (!extracted) return false;
        const compareValueRaw = strictEqualMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        const compareValue = parseCompareValue(compareValueRaw);
        return value === compareValue;
    }

    // Pattern 5: nodeName.xxx !== 'yyy'
    const notEqualMatch = trimmed.match(/^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*!==\s*['"]?(.+?)['"]?$/);
    if (notEqualMatch) {
        const extracted = extractNodeAndPath(notEqualMatch[1]);
        if (!extracted) return false;
        const compareValueRaw = notEqualMatch[2];
        const value = getNestedValue(extracted.nodeData, extracted.path);
        const compareValue = parseCompareValue(compareValueRaw);
        return value !== compareValue;
    }

    // Pattern 6: nodeName.xxx > 123 (or >=, <, <=)
    const comparisonMatch = trimmed.match(/^([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*\.[\w.]+)\s*(>=|<=|>|<)\s*(-?\d+\.?\d*)$/);
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
