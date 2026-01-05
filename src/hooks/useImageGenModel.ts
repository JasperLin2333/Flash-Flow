/**
 * useImageGenModel Hook
 * 
 * Encapsulates ImageGen model capability queries and derived calculations.
 * Provides a single source of truth for model-related state in ImageGenNodeForm.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    imageGenModelsAPI,
    type ImageGenModel,
    type ImageGenModelCapabilities,
    DEFAULT_IMAGEGEN_CAPABILITIES
} from "@/services/imageGenModelsAPI";
import { showError } from "@/utils/errorNotify";
import { SIZE_DISPLAY_NAMES, IMAGEGEN_CONFIG } from "@/store/constants/imageGenConstants";

export interface ImageGenModelHookResult {
    // Model data
    models: ImageGenModel[];
    loading: boolean;
    error: string | null;

    // Derived capabilities for selected model
    capabilities: ImageGenModelCapabilities;

    // Derived ranges
    stepRange: { min: number; max: number };
    cfgRange: { min: number; max: number };

    // Size options with display names
    sizeOptions: { value: string; label: string }[];

    // Utility functions
    getModelDisplayName: (modelId: string) => string;
    refetchModels: () => Promise<void>;

    // Quality <-> Steps conversion
    calculateQuality: (steps: number) => number;
    calculateSteps: (quality: number) => number;

    // CFG Quality <-> Value conversion (inverse mapping)
    calculateCfgQuality: (cfg: number) => number;
    calculateCfgValue: (quality: number) => number;
}

export function useImageGenModel(selectedModelId: string | undefined): ImageGenModelHookResult {
    const [models, setModels] = useState<ImageGenModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load models on mount
    const loadModels = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await imageGenModelsAPI.listModels();
            setModels(data);
            if (data.length === 0) {
                setError("暂无可用模型");
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "加载模型列表失败";
            setError(errorMsg);
            showError("模型加载失败", errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadModels();
    }, [loadModels]);

    // Derived capabilities from selected model
    const capabilities = useMemo((): ImageGenModelCapabilities => {
        const found = models.find(m => m.model_id === selectedModelId);
        return found?.capabilities || DEFAULT_IMAGEGEN_CAPABILITIES;
    }, [selectedModelId, models]);

    // Derived step range
    const stepRange = useMemo(() => ({
        min: capabilities.minInferenceSteps ?? IMAGEGEN_CONFIG.STEPS_MIN_DEFAULT,
        max: capabilities.maxInferenceSteps ?? IMAGEGEN_CONFIG.STEPS_MAX_DEFAULT,
    }), [capabilities]);

    // Derived CFG range
    const cfgRange = useMemo(() =>
        capabilities.cfgRange || { min: 0, max: 20 }
        , [capabilities]);

    // Size options with display names
    // Size options with display names
    const sizeOptions = useMemo(() => {
        const sizes = capabilities.imageSizes || [];
        return sizes.map((size: any) => {
            if (typeof size === 'object' && size !== null) {
                // Handle case where size is an object (e.g. { value: "1024x1024", label: "Square" })
                // This protects against inconsistent data structures from the API
                const value = size.value || "";
                const label = size.label || SIZE_DISPLAY_NAMES[value] || value;
                return { value, label };
            }

            // Handle standard string case
            const value = String(size);
            return {
                value,
                label: SIZE_DISPLAY_NAMES[value] || value,
            };
        });
    }, [capabilities]);

    // Get model display name
    const getModelDisplayName = useCallback((modelId: string): string => {
        const model = models.find(m => m.model_id === modelId);
        return model?.model_name || modelId.split('/').pop() || modelId;
    }, [models]);

    // Quality <-> Steps conversion
    // Formula: Quality = (Steps - Min) / (Max - Min) * 100
    const calculateQuality = useCallback((steps: number): number => {
        if (stepRange.max === stepRange.min) return 100;
        const quality = ((steps - stepRange.min) / (stepRange.max - stepRange.min)) * 100;
        return Math.round(Math.max(IMAGEGEN_CONFIG.QUALITY_MIN, Math.min(IMAGEGEN_CONFIG.QUALITY_MAX, quality)));
    }, [stepRange]);

    // Formula: Steps = Min + (Quality / 100) * (Max - Min)
    const calculateSteps = useCallback((quality: number): number => {
        const steps = stepRange.min + (quality / 100) * (stepRange.max - stepRange.min);
        return Math.round(Math.max(stepRange.min, Math.min(stepRange.max, steps)));
    }, [stepRange]);

    // CFG Quality <-> Value conversion (inverse: 100% = min CFG = most creative)
    const calculateCfgQuality = useCallback((cfg: number): number => {
        if (cfgRange.max === cfgRange.min) return 100;
        const quality = ((cfgRange.max - cfg) / (cfgRange.max - cfgRange.min)) * 100;
        return Math.round(Math.max(0, Math.min(100, quality)));
    }, [cfgRange]);

    const calculateCfgValue = useCallback((quality: number): number => {
        const val = cfgRange.max - (quality / 100) * (cfgRange.max - cfgRange.min);
        return Math.round(val * 10) / 10;
    }, [cfgRange]);

    return {
        models,
        loading,
        error,
        capabilities,
        stepRange,
        cfgRange,
        sizeOptions,
        getModelDisplayName,
        refetchModels: loadModels,
        calculateQuality,
        calculateSteps,
        calculateCfgQuality,
        calculateCfgValue,
    };
}
