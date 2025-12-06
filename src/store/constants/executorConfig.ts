/**
 * 执行器配置常量
 * 用于外部化原本硬编码的配置值
 */

// ===== LLM 节点配置 =====
export const LLM_EXECUTOR_CONFIG = {
    /** 默认模拟延迟（毫秒），用于演示执行进度 */
    DEFAULT_DELAY_MS: 2000,
    /** 默认模型名称 */
    DEFAULT_MODEL: "doubao-seed-1-6-flash-250828",
    /** 默认温度参数 */
    DEFAULT_TEMPERATURE: 0.7,
} as const;

// ===== 通用节点配置 =====
export const NODE_EXECUTOR_CONFIG = {
    /** 普通节点的模拟延迟（毫秒） */
    DEFAULT_DELAY_MS: 500,
} as const;

// ===== RAG 节点配置 =====
export const RAG_EXECUTOR_CONFIG = {
    /** 默认返回的文档数量 */
    DEFAULT_TOP_K: 5,
} as const;
