/**
 * Model Capabilities Registry
 * 
 * Maps model IDs to their supported features.
 * This is used by the LLMNodeForm to dynamically show/hide advanced parameters.
 */

export interface ModelCapabilities {
    /** Model supports reasoning content output (e.g., DeepSeek-R1) */
    hasReasoning: boolean;
    /** Model supports reasoning_effort parameter (e.g., OpenAI o1) */
    hasReasoningEffort: boolean;
    /** Model supports JSON mode (response_format: json_object) */
    supportsJsonMode: boolean;
    /** Model supports streaming reasoning in real-time */
    supportsStreamingReasoning: boolean;
}

/** Default capabilities for unknown models */
const DEFAULT_CAPABILITIES: ModelCapabilities = {
    hasReasoning: false,
    hasReasoningEffort: false,
    supportsJsonMode: true, // Most modern models support this
    supportsStreamingReasoning: false,
};

/**
 * Capabilities map: model_id prefix -> capabilities
 * Uses prefix matching so "deepseek-reasoner" matches "deepseek-reasoner-xxxx"
 */
const CAPABILITIES_MAP: Record<string, Partial<ModelCapabilities>> = {
    // DeepSeek Reasoner (Official)
    "deepseek-reasoner": {
        hasReasoning: true,
        supportsStreamingReasoning: true,
    },
    // DeepSeek R1 on SiliconFlow
    "deepseek-ai/DeepSeek-R1": {
        hasReasoning: true,
        supportsStreamingReasoning: true,
    },
    // OpenAI o1 series
    "o1": {
        hasReasoning: true,
        hasReasoningEffort: true,
        supportsJsonMode: false, // o1 doesn't support response_format
        supportsStreamingReasoning: false, // o1 returns reasoning after completion
    },
    "o3": {
        hasReasoning: true,
        hasReasoningEffort: true,
        supportsJsonMode: false,
        supportsStreamingReasoning: false,
    },
    // Standard chat models
    "deepseek-chat": {
        supportsJsonMode: true,
    },
    "gpt-4": {
        supportsJsonMode: true,
    },
    "gpt-3.5": {
        supportsJsonMode: true,
    },
    "qwen": {
        supportsJsonMode: true,
    },
    "doubao": {
        supportsJsonMode: true,
    },
    "xiaomi-": {
        supportsJsonMode: true,
    },
    "mimo-": {
        supportsJsonMode: true,
    },
};

/**
 * Get capabilities for a given model ID
 * Uses prefix matching to find the best match
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
    // Try exact prefix match first
    for (const [prefix, caps] of Object.entries(CAPABILITIES_MAP)) {
        if (modelId.startsWith(prefix) || modelId.toLowerCase().startsWith(prefix.toLowerCase())) {
            return { ...DEFAULT_CAPABILITIES, ...caps };
        }
    }

    // Fallback to default
    return DEFAULT_CAPABILITIES;
}

/**
 * Check if a model supports a specific capability
 */
export function modelSupports(modelId: string, capability: keyof ModelCapabilities): boolean {
    const caps = getModelCapabilities(modelId);
    return caps[capability];
}
