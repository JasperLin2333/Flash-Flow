/**
 * 执行器配置常量
 * 用于外部化原本硬编码的配置值
 */

// ===== LLM 节点配置 =====
export const LLM_EXECUTOR_CONFIG = {
    /** 默认模拟延迟（毫秒），用于演示执行进度 */
    DEFAULT_DELAY_MS: 200,
    /** 默认模型名称（从环境变量读取，便于统一修改） */
    get DEFAULT_MODEL() {
        return process.env.DEFAULT_LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || "deepseek-ai/DeepSeek-V3.2";
    },
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
