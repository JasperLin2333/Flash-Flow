/**
 * LLM Provider Configuration
 * 
 * Centralized configuration for LLM API providers.
 * Used by both streaming and non-streaming API routes.
 */

export const PROVIDER_CONFIG = {
    siliconflow: {
        baseURL: "https://api.siliconflow.cn/v1",
        getApiKey: () => process.env.SILICONFLOW_API_KEY || "",
    },
    dashscope: {
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        getApiKey: () => process.env.DASHSCOPE_API_KEY || "",
    },
    openai: {
        baseURL: "https://api.openai.com/v1",
        getApiKey: () => process.env.OPENAI_API_KEY || "",
    },
    google: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        getApiKey: () => process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
    },
} as const;

export type LLMProvider = keyof typeof PROVIDER_CONFIG;

/**
 * Determine the provider based on model ID prefix
 * - deepseek-ai/* → SiliconFlow
 * - Qwen/* or qwen-* → DashScope
 * - gpt-* → OpenAI
 * - Default: SiliconFlow (for new models)
 */
export function getProviderForModel(model: string): LLMProvider {
    const modelLower = model.toLowerCase();

    if (model.startsWith("deepseek-ai/") || modelLower.startsWith("deepseek")) {
        return "siliconflow";
    }
    if (model.startsWith("Qwen/") || modelLower.startsWith("qwen")) {
        return "dashscope";
    }
    if (modelLower.startsWith("gpt-")) {
        return "openai";
    }
    if (modelLower.startsWith("gemini-") || modelLower.startsWith("google/")) {
        return "google";
    }

    // Default to SiliconFlow for unknown models
    return "siliconflow";
}
