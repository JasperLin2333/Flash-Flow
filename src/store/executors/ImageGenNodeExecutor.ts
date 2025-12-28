/**
 * ImageGen Node Executor
 * 
 * Executes image generation using SiliconFlow API.
 * Supports variable substitution in prompts via {{变量}} syntax.
 */

import type { AppNode, FlowContext, ImageGenNodeData } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { useFlowStore } from "@/store/flowStore";
import { useQuotaStore } from "@/store/quotaStore";
import { collectVariables } from "./utils/variableUtils";
import { DEFAULT_IMAGEGEN_CAPABILITIES } from "@/services/imageGenModelsAPI";

export class ImageGenNodeExecutor extends BaseNodeExecutor {
    async execute(
        node: AppNode,
        context: FlowContext,
        mockData?: Record<string, unknown>
    ): Promise<ExecutionResult> {
        // Check quota first
        const quotaError = await this.checkQuota();
        if (quotaError) {
            return quotaError;
        }

        const { result, time } = await this.measureTime(async () => {
            const nodeData = node.data as ImageGenNodeData;
            let prompt = nodeData.prompt || "";

            // Get flow store state for variable collection
            const storeState = useFlowStore.getState();
            const { nodes: allNodes, flowContext: globalFlowContext } = storeState;

            // 使用公共的 collectVariables 函数，确保与其他节点一致的变量解析逻辑
            const allVariables = collectVariables(context, globalFlowContext, allNodes);

            // Replace variables in prompt
            if (Object.keys(allVariables).length > 0) {
                prompt = replaceVariables(prompt, allVariables);
            }

            // Handle mock data for debug mode
            if (mockData && Object.keys(mockData).length > 0) {
                const stringValues: Record<string, string> = {};
                Object.entries(mockData).forEach(([key, value]) => {
                    stringValues[key] = String(value);
                });
                prompt = replaceVariables(prompt, stringValues);
            }

            // Get current user for quota tracking
            const user = await authService.getCurrentUser();

            // Get model capabilities for cfgParam and defaults
            const modelId = nodeData.model || "Kwai-Kolors/Kolors";
            const { imageGenModelsAPI } = await import("@/services/imageGenModelsAPI");
            const modelInfo = await imageGenModelsAPI.getModelByModelId(modelId);
            const capabilities = modelInfo?.capabilities || DEFAULT_IMAGEGEN_CAPABILITIES;
            const cfgParam = capabilities.cfgParam || null;

            // Apply model-aware defaults when values are undefined
            // Priority: nodeData > modelCapabilities > hardcoded fallback
            const effectiveCfg = nodeData.cfg ?? nodeData.guidanceScale ?? capabilities.defaultCfg ?? 7.5;
            const effectiveSteps = nodeData.numInferenceSteps ?? capabilities.defaultSteps ?? 25;
            const effectiveImageSize = nodeData.imageSize ?? capabilities.imageSizes?.[0] ?? "1024x1024";

            // Resolve reference images based on mode
            let image: string | undefined;
            let image2: string | undefined;
            let image3: string | undefined;

            if (nodeData.referenceImageMode === 'variable') {
                // Variable mode: resolve {{variable}} placeholders
                const stringValues: Record<string, string> = {};
                Object.entries(allVariables).forEach(([k, v]) => {
                    if (typeof v === 'string') stringValues[k] = v;
                    else if (v && typeof v === 'object') stringValues[k] = JSON.stringify(v);
                });

                if (nodeData.referenceImageVariable) {
                    image = replaceVariables(nodeData.referenceImageVariable, stringValues);
                }
                if (nodeData.referenceImage2Variable) {
                    image2 = replaceVariables(nodeData.referenceImage2Variable, stringValues);
                }
                if (nodeData.referenceImage3Variable) {
                    image3 = replaceVariables(nodeData.referenceImage3Variable, stringValues);
                }
            } else {
                // Static mode: use uploaded URL
                image = nodeData.referenceImageUrl;
                image2 = nodeData.referenceImageUrl2;
                image3 = nodeData.referenceImageUrl3;
            }

            // Call image generation API
            const response = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: modelId,
                    prompt,
                    negativePrompt: nodeData.negativePrompt,
                    imageSize: capabilities.supportsImageSize !== false ? effectiveImageSize : undefined,
                    cfg: effectiveCfg,
                    cfgParam,
                    numInferenceSteps: effectiveSteps,
                    userId: user?.id,
                    // Reference images (frontend: referenceImageUrl -> API: image)
                    image,
                    image2,
                    image3,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Image generation failed: ${response.status}`);
            }

            const data = await response.json();

            // Refresh quota display
            if (user) {
                const { refreshQuota } = useQuotaStore.getState();
                await refreshQuota(user.id);
            }

            return {
                imageUrl: data.imageUrl,
            };
        });

        return {
            output: result,
            executionTime: time,
        };
    }

    /**
     * Check if user has remaining image generation quota
     */
    private async checkQuota(): Promise<ExecutionResult | null> {
        try {
            const user = await authService.getCurrentUser();
            if (!user) {
                return {
                    output: { error: "请先登录以使用图片生成功能" },
                    executionTime: 0,
                };
            }

            const quotaCheck = await quotaService.checkQuota(user.id, "image_gen_executions");
            if (!quotaCheck.allowed) {
                return {
                    output: { error: `图片生成次数已用完 (${quotaCheck.used}/${quotaCheck.limit})。请联系管理员增加配额。` },
                    executionTime: 0,
                };
            }
        } catch (e) {
            return {
                output: { error: "配额检查失败，请稍后重试" },
                executionTime: 0,
            };
        }
        return null;
    }
}

