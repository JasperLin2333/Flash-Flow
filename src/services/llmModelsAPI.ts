/**
 * LLM Models API
 * Manages LLM model data from Supabase
 */

import { supabase } from "@/lib/supabase";
import { getProviderForModel } from "@/lib/llmProvider";

// ============ Types ============
export interface ModelCapabilities {
    hasReasoning: boolean;
    hasReasoningEffort: boolean;
    supportsJsonMode: boolean;
    supportsStreamingReasoning: boolean;
}

export interface LLMModel {
    id: string;
    model_id: string;
    model_name: string;
    provider: string;
    is_active: boolean;
    display_order: number;
    capabilities: ModelCapabilities;
    points_cost?: number | null;
}

// ============ Default Fallback Models ============
// Uses environment variable for easy configuration
const DEFAULT_CAPABILITIES: ModelCapabilities = {
    hasReasoning: false,
    hasReasoningEffort: false,
    supportsJsonMode: true,
    supportsStreamingReasoning: false,
};

const REASONING_CAPABILITIES: ModelCapabilities = {
    hasReasoning: true,
    hasReasoningEffort: false,
    supportsJsonMode: true,
    supportsStreamingReasoning: true,
};

const inferPointsCost = (modelId: string): number => {
    const model = (modelId || "").toLowerCase();
    const isHigh = model.includes("reasoner")
        || model.includes("r1")
        || model.includes("o1")
        || model.includes("o3")
        || model.includes("gpt-4")
        || model.includes("claude-3")
        || model.includes("4o");
    if (isHigh) return 8;

    const isLow = model.includes("flash")
        || model.includes("turbo")
        || model.includes("3.5")
        || model.includes("mini")
        || model.includes("lite");
    if (isLow) return 1;

    return 3;
};

const getDefaultModels = (): LLMModel[] => {
    const defaultModel = process.env.DEFAULT_LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || "deepseek-ai/DeepSeek-V3.2";
    const modelName = defaultModel.split("/").pop() || "DeepSeek-V3.2";

    return [
        {
            id: "default-1",
            model_id: defaultModel,
            model_name: modelName,
            provider: getProviderForModel(defaultModel),
            is_active: true,
            display_order: 1,
            capabilities: DEFAULT_CAPABILITIES,
            points_cost: inferPointsCost(defaultModel),
        },
        {
            id: "ds-chat",
            model_id: "deepseek-chat",
            model_name: "DeepSeek-V3 (Official)",
            provider: "deepseek",
            is_active: true,
            display_order: 2,
            capabilities: DEFAULT_CAPABILITIES,
            points_cost: inferPointsCost("deepseek-chat"),
        },
        {
            id: "ds-reasoner",
            model_id: "deepseek-reasoner",
            model_name: "DeepSeek-R1 (Official)",
            provider: "deepseek",
            is_active: true,
            display_order: 3,
            capabilities: REASONING_CAPABILITIES,
            points_cost: inferPointsCost("deepseek-reasoner"),
        },
    ];
};

// ============ Cache Configuration ============
// Memory cache to avoid repeated API calls
let modelsCache: LLMModel[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Deduplication: Promise to hold the pending request
let pendingRequest: Promise<LLMModel[]> | null = null;

// ============ API Functions ============
export const llmModelsAPI = {
    /**
     * List all active LLM models
     * Returns models sorted by display_order
     * Uses memory cache with 5-minute TTL and request deduplication
     */
    async listModels(): Promise<LLMModel[]> {
        // 1. Check cache first
        const now = Date.now();
        if (modelsCache && (now - cacheTimestamp) < CACHE_TTL) {
            return modelsCache;
        }

        // 2. Check for pending request (Deduplication)
        if (pendingRequest) {
            return pendingRequest;
        }

        // 3. Create new request
        pendingRequest = (async () => {
            try {
                const { data, error } = await supabase
                    .from("llm_models")
                    .select("*")
                    .eq("is_active", true)
                    .order("display_order", { ascending: true });

                if (error) {
                    console.error("[llmModelsAPI] listModels error:", error);
                    return getDefaultModels();
                }

                // If no models found, return defaults
                if (!data || data.length === 0) {
                    console.warn("[llmModelsAPI] No models found, using defaults");
                    return getDefaultModels();
                }

                const models = data as unknown as LLMModel[];

                // Update cache
                modelsCache = models;
                cacheTimestamp = Date.now();

                return models;
            } catch (e) {
                console.error("[llmModelsAPI] listModels exception:", e);
                return getDefaultModels();
            } finally {
                // Clear pending request so next call can retry if needed or use cache
                pendingRequest = null;
            }
        })();

        return pendingRequest;
    },

    /**
     * Invalidate the models cache
     * Call this when models are updated (e.g., from admin panel)
     */
    invalidateCache() {
        modelsCache = null;
        cacheTimestamp = 0;
        pendingRequest = null;
    },

    /**
     * Get a single model by model_id
     * Tries to find in cache first, then DB
     */
    async getModelByModelId(modelId: string): Promise<LLMModel | null> {
        // Try finding in cache first (if valid)
        const now = Date.now();
        if (modelsCache && (now - cacheTimestamp) < CACHE_TTL) {
            const cached = modelsCache.find(m => m.model_id === modelId);
            if (cached) return cached;
        }

        try {
            const { data, error } = await supabase
                .from("llm_models")
                .select("*")
                .eq("model_id", modelId)
                .single();

            if (error) {
                console.warn(`[llmModelsAPI] getModelByModelId DB error for ${modelId}, trying defaults`);
                // Fallback: try to find in default models
                const defaultModel = getDefaultModels().find(m => m.model_id === modelId);
                if (defaultModel) return defaultModel;
                return null;
            }

            return data as unknown as LLMModel;
        } catch (e) {
            console.error(`[llmModelsAPI] getModelByModelId exception for ${modelId}:`, e);
            // Fallback: try to find in default models
            const defaultModel = getDefaultModels().find(m => m.model_id === modelId);
            if (defaultModel) return defaultModel;
            return null;
        }
    },
};
