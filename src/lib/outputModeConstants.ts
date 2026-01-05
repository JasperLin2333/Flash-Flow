/**
 * 输出节点模式常量
 * 共享定义，用于 OutputNodeConfig、OutputMetadata、OutputDebugDialog 等组件
 */

import type { OutputMode } from "@/types/flow";

/**
 * 输出模式选项配置
 */
export const OUTPUT_MODE_OPTIONS: {
    value: OutputMode;
    label: string;
    description: string;
}[] = [
        { value: 'direct', label: '直接引用', description: '从单一上游节点获取输出' },
        { value: 'select', label: '分支选择', description: '从多个来源中选择第一个非空结果' },
        { value: 'merge', label: '内容合并', description: '将多个来源的内容合并输出' },
        { value: 'template', label: '模板渲染', description: '自定义输出格式模板(非流式输出)' },
    ];

/**
 * 获取输出模式的显示标签
 * @param mode 输出模式
 * @returns 对应的中文标签
 */
export function getOutputModeLabel(mode: OutputMode | string): string {
    const option = OUTPUT_MODE_OPTIONS.find(o => o.value === mode);
    return option?.label || '直接引用';
}

/**
 * 获取输出模式的描述
 * @param mode 输出模式
 * @returns 对应的描述文本
 */
export function getOutputModeDescription(mode: OutputMode | string): string {
    const option = OUTPUT_MODE_OPTIONS.find(o => o.value === mode);
    return option?.description || '';
}
