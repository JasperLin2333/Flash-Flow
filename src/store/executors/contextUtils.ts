import type { FlowContext, AppNode } from "@/types/flow";

/**
 * 从 FlowContext 中提取上游节点数据
 * 过滤掉 _meta 等以 "_" 开头的内部字段
 * 
 * @param context - 流程执行上下文
 * @returns 第一个上游节点的输出数据，如果没有则返回 null
 */
export function getUpstreamData(context: FlowContext): unknown {
    const entries = Object.entries(context).filter(
        ([key]) => !key.startsWith('_')
    );
    return entries.length > 0 ? entries[0][1] : null;
}

/**
 * 从 FlowContext 中提取所有上游节点数据的 entries
 * 过滤掉 _meta 等以 "_" 开头的内部字段
 * 
 * @param context - 流程执行上下文
 * @returns 过滤后的 [nodeId, output] 数组
 */
export function getUpstreamEntries(context: FlowContext): [string, unknown][] {
    return Object.entries(context).filter(
        ([key]) => !key.startsWith('_')
    );
}

/**
 * 字段提取优先级配置
 * 按顺序尝试提取，返回第一个非空字符串值
 * 
 * 这些字段名对应各节点类型的标准输出:
 * - text: OutputNodeExecutor 的输出字段
 * - response: LLMNodeExecutor 的输出字段
 * - user_input: InputNodeExecutor 的输出字段
 * - query: RAGNodeExecutor 的输出字段
 */
const TEXT_FIELD_PRIORITY = ['text', 'response', 'user_input', 'query'] as const;

/**
 * Branch 节点的元数据字段，应该被过滤掉
 * 这些字段是 BranchNodeExecutor 添加的，不应该出现在最终输出中
 */
const BRANCH_METADATA_FIELDS = ['conditionResult', 'passed', 'value'] as const;

/**
 * 从上游数据中提取文本内容
 * 
 * 优先级: text > response > user_input > query > JSON stringify
 * 
 * @param data - 上游节点的输出数据
 * @param fallbackToJson - 如果无法提取文本，是否返回 JSON 字符串（默认 true）
 * @returns 提取的文本内容
 */
export function extractTextFromUpstream(data: unknown, fallbackToJson = true): string {
    if (!data) return "";

    if (typeof data === 'string') {
        return data;
    }

    if (typeof data !== 'object') {
        return String(data);
    }

    const obj = data as Record<string, unknown>;

    // 按优先级尝试提取文本字段
    for (const field of TEXT_FIELD_PRIORITY) {
        const value = obj[field];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    // 检查是否是 Branch 节点的输出（包含 conditionResult）
    // 如果是，则尝试从嵌套的上游数据中提取文本
    if ('conditionResult' in obj) {
        // Branch 节点透传了上游数据，尝试从中提取
        const cleanedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            // 跳过 Branch 元数据字段
            if (!BRANCH_METADATA_FIELDS.includes(key as typeof BRANCH_METADATA_FIELDS[number])) {
                cleanedData[key] = value;
            }
        }

        // 如果清理后还有数据，递归提取
        if (Object.keys(cleanedData).length > 0) {
            // 先尝试从清理后的对象中提取文本字段
            for (const field of TEXT_FIELD_PRIORITY) {
                const value = cleanedData[field];
                if (typeof value === 'string' && value.trim()) {
                    return value;
                }
            }
            // 如果还是没有，返回清理后的 JSON
            if (fallbackToJson) {
                return JSON.stringify(cleanedData);
            }
        }
        return "";
    }

    // 兜底：返回 JSON 字符串
    return fallbackToJson ? JSON.stringify(data) : "";
}

/**
 * 从 FlowContext 中提取输入文本
 * 组合了 getUpstreamData 和 extractTextFromUpstream 的功能
 * 
 * @param context - 流程执行上下文
 * @param defaultValue - 如果无法提取则返回的默认值
 * @returns 提取的文本内容
 */
export function extractInputFromContext(context: FlowContext, defaultValue = ""): string {
    const data = getUpstreamData(context);
    if (!data) return defaultValue;
    return extractTextFromUpstream(data) || defaultValue;
}

/**
 * 从 FlowContext 中提取完整的输出结果（包含文本和附件）
 * 专用于 Chat 界面展示
 * 
 * @param nodes - 节点列表，用于查找 Output 节点
 * @param context - 流程执行上下文
 * @returns { text: string, attachments: Array<{ name: string; url: string; ... }> }
 */
export function extractOutputFromContext(
    nodes: AppNode[],
    context: FlowContext
): { text: string; attachments: { name: string; url: string; type?: string; size?: number }[] } {
    const outputNode = nodes.find(n => n.type === "output");

    // 如果没有 Output 节点，返回提示
    if (!outputNode) {
        return {
            text: "请在工作流中添加 Output 节点以显示输出结果。",
            attachments: []
        };
    }

    const outData = context[outputNode.id];

    // 如果没有输出数据，返回提示
    if (!outData) {
        return {
            text: "工作流已完成，但未生成输出。",
            attachments: []
        };
    }

    // 尝试解析 OutputNodeExecutor 的标准输出结构
    if (typeof outData === 'object' && outData !== null) {
        const data = outData as Record<string, unknown>;

        // 1. 提取附件
        const attachments = Array.isArray(data.attachments)
            ? (data.attachments as { name: string; url: string; type?: string }[])
            : [];

        // 2. 提取文本
        // 如果是 OutputNodeExecutor 生成的，应该有 text 字段
        if (typeof data.text === 'string') {
            return {
                text: data.text,
                attachments
            };
        }
    }

    // 兜底：如果数据结构不符合预期，使用通用文本提取逻辑
    return {
        text: extractTextFromUpstream(outData, true) || "工作流已完成，但未生成输出。",
        attachments: []
    };
}
