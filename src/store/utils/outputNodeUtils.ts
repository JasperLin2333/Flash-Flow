import type { AppNode, OutputNodeData, OutputInputMappings } from "@/types/flow";

/**
 * Output 节点工具函数集
 * 提供类型安全的数据访问和断言
 */

/** 类型安全的 OutputNodeData 获取 */
export function getOutputNodeData(node: AppNode): OutputNodeData | undefined {
    if (node.type !== 'output') return undefined;
    return node.data as OutputNodeData;
}

/** 类型安全的 inputMappings 获取 */
export function getOutputInputMappings(node: AppNode): OutputInputMappings | undefined {
    const data = getOutputNodeData(node);
    return data?.inputMappings;
}

/** 从任意节点数据中安全提取 inputMappings（用于需要类型断言的场景） */
export function extractInputMappings(nodeData: unknown): OutputInputMappings | undefined {
    if (!nodeData || typeof nodeData !== 'object') return undefined;
    const data = nodeData as { inputMappings?: OutputInputMappings };
    return data.inputMappings;
}

/** 检查 Output 节点是否已配置（有有效的 sources 或 template） */
export function isOutputNodeConfigured(node: AppNode): boolean {
    const mappings = getOutputInputMappings(node);
    if (!mappings) return false;

    const mode = mappings.mode || 'direct';

    if (mode === 'template') {
        return !!(mappings.template && mappings.template.trim());
    }

    // direct, select, merge 模式需要至少一个有效的 source
    return !!(mappings.sources && mappings.sources.length > 0 &&
        mappings.sources.some(s => s.value && s.value.trim()));
}
