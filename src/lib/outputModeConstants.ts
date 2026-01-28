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
        { value: 'direct', label: '直接输出', description: '直接透传上游回复' },
        { value: 'select', label: '条件择优', description: '自动采纳首个有效回复' },
        { value: 'merge', label: '内容拼接', description: '串联多个回复内容' },
        { value: 'template', label: '自定义模版', description: '灵活编排最终回复格式' },
    ];

/**
 * 获取输出模式的显示标签
 * @param mode 输出模式
 * @returns 对应的中文标签
 */
export function getOutputModeLabel(mode: OutputMode | string): string {
    const option = OUTPUT_MODE_OPTIONS.find(o => o.value === mode);
    return option?.label || '直接输出';
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
