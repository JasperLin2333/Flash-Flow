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
const DEFAULT_MODELS: LLMModel[] = [
    {
        id: "default-1",
        model_id: "doubao-seed-1-6-flash-250828",
        model_name: "豆包-1-6-flash",
        provider: "doubao",
        is_active: true,
        display_order: 1,
    },
    {
        id: "default-2",
        model_id: "qwen-flash",
        model_name: "Qwen-Flash",
        provider: "dashscope",
        is_active: true,
        display_order: 2,
    },
];

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
                return DEFAULT_MODELS;
            }

            // If no models found, return defaults
            if (!data || data.length === 0) {
                console.warn("[llmModelsAPI] No models found, using defaults");
                return DEFAULT_MODELS;
            }

            const models = data as LLMModel[];



            return models;
        } catch (e) {
            console.error("[llmModelsAPI] listModels exception:", e);
            // Fallback to default models on exception
            return DEFAULT_MODELS;
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
