/**
 * LLM Provider Configuration
 * 
 * Centralized configuration for LLM API providers.
 * Used by both streaming and non-streaming API routes.
 */

interface ProviderInfo {
    baseURL: string;
    getApiKey: () => string;
    prefixes: string[];
}

export const PROVIDER_CONFIG: Record<string, ProviderInfo> = {
    doubao: {
        baseURL: "https://ark.cn-beijing.volces.com/api/v3",
        getApiKey: () => process.env.DOUBAO_API_KEY || process.env.VOLCENGINE_API_KEY || "",
        prefixes: ["doubao", "deepseek-v3"],  // 火山引擎的 DeepSeek 模型
    },
    deepseek: {
        baseURL: "https://api.deepseek.com",
        getApiKey: () => process.env.DEEPSEEK_API_KEY || "",
        prefixes: ["deepseek-chat", "deepseek-reasoner"],
    },
    openai: {
        baseURL: "https://api.openai.com/v1",
        getApiKey: () => process.env.OPENAI_API_KEY || "",
        prefixes: ["gpt-"],
    },
    google: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        getApiKey: () => process.env.GEMINI_API_KEY || "",
        prefixes: ["gemini-", "google/"],
    },
    dashscope: {
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        getApiKey: () => process.env.DASHSCOPE_API_KEY || "",
        prefixes: ["qwen"], // qwen- (dashscope official usually doesn't have slash)
    },
    siliconflow: {
        baseURL: "https://api.siliconflow.cn/v1",
        getApiKey: () => process.env.SILICONFLOW_API_KEY || "",
        prefixes: ["deepseek-ai/", "Qwen/", "internlm/", "THUDM/"], // More specific SF prefixes
    },
} as const;

export type LLMProvider = keyof typeof PROVIDER_CONFIG;

/**
 * Determine the provider based on model ID prefix
 */
export function getProviderForModel(model: string): LLMProvider {
    const modelLower = model.toLowerCase();

    // 1. Try to find a specific match based on defined prefixes
    for (const [provider, config] of Object.entries(PROVIDER_CONFIG)) {
        if (config.prefixes.some(prefix =>
            model.startsWith(prefix) || modelLower.startsWith(prefix.toLowerCase())
        )) {
            return provider as LLMProvider;
        }
    }

    // 2. Special fallback for broad "deepseek" keyword if no specific prefix matched
    if (modelLower.startsWith("deepseek")) {
        return "siliconflow";
    }

    // 3. Ultimate default
    return "siliconflow";
}
