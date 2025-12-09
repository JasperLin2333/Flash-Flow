/**
 * LLM Models API
 * Manages LLM model data from Supabase
 */

import { supabase } from "@/lib/supabase";

// ============ Types ============
export interface LLMModel {
    id: string;
    model_id: string;
    model_name: string;
    provider: string;
    is_active: boolean;
    display_order: number;
}

// ============ Default Fallback Models ============
// Uses environment variable for easy configuration
const getDefaultModels = (): LLMModel[] => {
    const defaultModel = process.env.DEFAULT_LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || "deepseek-ai/DeepSeek-V3.2";
    const modelName = defaultModel.split("/").pop() || "DeepSeek-V3.2";

    return [
        {
            id: "default-1",
            model_id: defaultModel,
            model_name: modelName,
            provider: "siliconflow",
            is_active: true,
            display_order: 1,
        },
    ];
};

// ============ API Functions ============
export const llmModelsAPI = {
    /**
     * List all active LLM models
     * Returns models sorted by display_order
     */
    async listModels(): Promise<LLMModel[]> {
        try {
            const { data, error } = await supabase
                .from("llm_models")
                .select("*")
                .eq("is_active", true)
                .order("display_order", { ascending: true });

            if (error) {
                console.error("[llmModelsAPI] listModels error:", error);
                // Fallback to default models on error
                return getDefaultModels();
            }

            // If no models found, return defaults
            if (!data || data.length === 0) {
                console.warn("[llmModelsAPI] No models found, using defaults");
                return getDefaultModels();
            }

            const models = data as LLMModel[];
            console.log("[llmModelsAPI] Loaded models from DB:", models.length, models.map(m => m.model_name));

            return models;
        } catch (e) {
            console.error("[llmModelsAPI] listModels exception:", e);
            // Fallback to default models on exception
            return getDefaultModels();
        }
    },

    /**
     * Get a single model by model_id
     */
    async getModelByModelId(modelId: string): Promise<LLMModel | null> {
        try {
            const { data, error } = await supabase
                .from("llm_models")
                .select("*")
                .eq("model_id", modelId)
                .single();

            if (error) {
                console.error(`[llmModelsAPI] getModelByModelId error for ${modelId}:`, error);
                return null;
            }

            return data as LLMModel;
        } catch (e) {
            console.error(`[llmModelsAPI] getModelByModelId exception for ${modelId}:`, e);
            return null;
        }
    },
};
