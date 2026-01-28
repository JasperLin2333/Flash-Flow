/**
 * Image Generation Models API
 * Manages image generation model data from Supabase
 * Pattern follows llmModelsAPI.ts
 */

import { supabase } from "@/lib/supabase";

// ============ Types ============

/**
 * Image generation model capabilities
 * Determines which form fields are shown based on model selection
 */
export interface ImageGenModelCapabilities {
    supportsNegativePrompt: boolean;      // 是否支持负向提示词
    supportsImageSize: boolean;           // 是否支持 image_size 参数
    supportsReferenceImage: boolean;      // 是否支持参考图 (图生图)
    supportsInferenceSteps: boolean;      // 是否支持推理步数
    minInferenceSteps?: number;           // 最小推理步数 (默认 1)
    maxInferenceSteps?: number;           // 最大推理步数 (默认 50)
    cfgParam: 'guidance_scale' | 'cfg' | null; // CFG 参数名 (不同模型不同)
    cfgRange?: { min: number; max: number };   // CFG 范围
    defaultCfg?: number;                  // 默认 CFG 值
    defaultSteps?: number;                // 默认推理步数
    imageSizes?: string[] | null;                 // 支持的图片尺寸列表
    maxReferenceImages?: number;          // 最多支持的参考图数量 (Edit-2509 为 3)
}

/** Default capabilities when model has no capabilities configured */
export const DEFAULT_IMAGEGEN_CAPABILITIES: ImageGenModelCapabilities = {
    supportsNegativePrompt: false,
    supportsImageSize: true,
    supportsReferenceImage: false,
    supportsInferenceSteps: false,
    minInferenceSteps: 1,
    maxInferenceSteps: 50,
    cfgParam: null,
};

export interface ImageGenModel {
    id: string;
    model_id: string;
    model_name: string;
    provider: string;        // e.g., "siliconflow"
    is_active: boolean;
    display_order: number;
    capabilities?: ImageGenModelCapabilities;
    points_cost?: number;
}

// ============ Default Fallback Models ============
// 尺寸显示名称从共享常量导入
import { SIZE_DISPLAY_NAMES } from "@/store/constants/imageGenConstants";
// Re-export for backward compatibility
export { SIZE_DISPLAY_NAMES };

/**
 * Model capabilities lookup table for shared use (Form and API)
 */
export const MODEL_CAPABILITIES: Record<string, ImageGenModelCapabilities> = {
    "Kwai-Kolors/Kolors": {
        supportsNegativePrompt: true,
        supportsImageSize: true,
        supportsReferenceImage: false,
        supportsInferenceSteps: true,
        minInferenceSteps: 1,
        maxInferenceSteps: 49,
        cfgParam: 'guidance_scale',
        cfgRange: { min: 0, max: 20 },
        defaultCfg: 7.5,
        defaultSteps: 25,
        imageSizes: ['1024x1024', '960x1280', '768x1024', '720x1440', '720x1280'],
    },
    "Qwen/Qwen-Image": {
        supportsNegativePrompt: true,
        supportsImageSize: true,
        supportsReferenceImage: false,
        supportsInferenceSteps: true,
        minInferenceSteps: 1,
        maxInferenceSteps: 50,
        cfgParam: 'cfg',
        cfgRange: { min: 0.1, max: 20 },
        defaultCfg: 4.0,
        defaultSteps: 50,
        imageSizes: ['1328x1328', '1664x928', '928x1664', '1472x1140', '1140x1472', '1584x1056', '1056x1584'],
    },
    "Qwen/Qwen-Image-Edit-2509": {
        supportsNegativePrompt: true,
        supportsImageSize: false,
        supportsReferenceImage: true,
        supportsInferenceSteps: true,
        minInferenceSteps: 1,
        maxInferenceSteps: 50,
        cfgParam: 'cfg',
        cfgRange: { min: 0.1, max: 20 },
        defaultCfg: 4.0,
        defaultSteps: 50,
        imageSizes: null,
        maxReferenceImages: 3,
    },
};

const getDefaultModels = (): ImageGenModel[] => {
    return [
        {
            id: "kolors",
            model_id: "Kwai-Kolors/Kolors",
            model_name: "可灵",
            provider: "siliconflow",
            is_active: true,
            display_order: 1,
            capabilities: MODEL_CAPABILITIES["Kwai-Kolors/Kolors"],
            points_cost: 12,
        },
        {
            id: "qwen-image",
            model_id: "Qwen/Qwen-Image",
            model_name: "千问-文生图",
            provider: "siliconflow",
            is_active: true,
            display_order: 2,
            capabilities: MODEL_CAPABILITIES["Qwen/Qwen-Image"],
            points_cost: 14,
        },
        {
            id: "qwen-image-edit",
            model_id: "Qwen/Qwen-Image-Edit-2509",
            model_name: "千问-图生图",
            provider: "siliconflow",
            is_active: true,
            display_order: 3,
            capabilities: MODEL_CAPABILITIES["Qwen/Qwen-Image-Edit-2509"],
            points_cost: 16,
        },
    ];
};


// ============ Cache Configuration ============
let modelsCache: ImageGenModel[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============ API Functions ============
export const imageGenModelsAPI = {
    /**
     * List all active image generation models
     * Returns models sorted by display_order
     * Uses memory cache with 5-minute TTL
     */
    async listModels(): Promise<ImageGenModel[]> {
        // Check cache first
        const now = Date.now();
        if (modelsCache && (now - cacheTimestamp) < CACHE_TTL) {
            return modelsCache;
        }

        try {
            const { data, error } = await supabase
                .from("image_gen_models")
                .select("*")
                .eq("is_active", true)
                .order("display_order", { ascending: true });

            if (error) {
                console.error("[imageGenModelsAPI] listModels error:", error);
                // Fallback to default models on error
                return getDefaultModels();
            }

            // If no models found, return defaults
            if (!data || data.length === 0) {
                console.warn("[imageGenModelsAPI] No models found, using defaults");
                return getDefaultModels();
            }

            // 🟢 CRITICAL FIX: Merge fetched models with local hardcoded capabilities
            // This ensures that even if DB capabilities are missing/outdated,
            // we use the correct local definitions for known models.
            const models = (data as ImageGenModel[]).map(model => {
                const knownCaps = MODEL_CAPABILITIES[model.model_id];
                if (knownCaps) {
                    return {
                        ...model,
                        capabilities: {
                            ...model.capabilities, // DB params take precedence if they exist
                            ...knownCaps,          // Local params fill gaps (e.g., imageSizes)
                            // Force-overwrite critical arrays if DB is null
                            imageSizes: model.capabilities?.imageSizes || knownCaps.imageSizes,
                        }
                    };
                }
                return model;
            });

            // Update cache
            modelsCache = models;
            cacheTimestamp = now;

            return models;
        } catch (e) {
            console.error("[imageGenModelsAPI] listModels exception:", e);
            // Fallback to default models on exception
            return getDefaultModels();
        }
    },

    /**
     * Invalidate the models cache
     */
    invalidateCache() {
        modelsCache = null;
        cacheTimestamp = 0;
    },

    /**
     * Get a single model by model_id
     */
    async getModelByModelId(modelId: string): Promise<ImageGenModel | null> {
        try {
            // First try to find in default models (fastest and reliable for base models)
            const defaults = getDefaultModels();
            const foundInDefaults = defaults.find(m => m.model_id === modelId);
            if (foundInDefaults) {
                return foundInDefaults;
            }

            // Then try database
            const { data, error } = await supabase
                .from("image_gen_models")
                .select("*")
                .eq("model_id", modelId)
                .single();

            if (error) {
                console.warn(`[imageGenModelsAPI] getModelByModelId lookup failed for ${modelId}, checking defaults...`);
                // Fallback again to defaults just in case logic changes above
                const defaults = getDefaultModels();
                const found = defaults.find(m => m.model_id === modelId);
                if (found) return found;

                console.error(`[imageGenModelsAPI] Model not found in DB or defaults: ${modelId}`);
                return null;
            }

            return data as ImageGenModel;
        } catch (e) {
            console.error(`[imageGenModelsAPI] getModelByModelId exception for ${modelId}:`, e);
            // Final fallback attempt
            const defaults = getDefaultModels();
            const found = defaults.find(m => m.model_id === modelId);
            if (found) return found;

            return null;
        }
    },
};
