/**
 * 节点输出字段常量定义
 * 用于 contextUtils 和其他相关逻辑中处理节点输出数据
 */

/**
 * 文本字段提取优先级
 * 用于 extractTextFromUpstream 中确定优先使用哪个字段作为文本输出
 * 顺序表示优先级从高到低
 */
export const TEXT_FIELD_PRIORITY = ['text', 'response', 'user_input', 'query'] as const;

/**
 * Branch 节点内部元数据字段
 * 在从上下文提取数据时，这些字段通常应该被过滤
 */
export const BRANCH_METADATA_FIELDS = ['conditionResult', 'passed', 'value'] as const;
