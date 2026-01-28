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
import { isValidImageValue } from "./utils/validationUtils";
import { DEFAULT_IMAGEGEN_CAPABILITIES } from "@/services/imageGenModelsAPI";
import { IMAGEGEN_CONFIG } from "@/store/constants/imageGenConstants";
import { imageGenService } from "@/services/imageGenService";

export class ImageGenNodeExecutor extends BaseNodeExecutor {
    async execute(
        node: AppNode,
        context: FlowContext,
        mockData?: Record<string, unknown>
    ): Promise<ExecutionResult> {
        const nodeData = node.data as ImageGenNodeData;
        const modelId = nodeData.model || IMAGEGEN_CONFIG.DEFAULT_MODEL;

        const quotaError = await this.checkQuota(modelId);
        if (quotaError) {
            return quotaError;
        }

        const { result, time } = await this.measureTime(async () => {

            // Get flow store state for variable collection
            const storeState = useFlowStore.getState();
            const { nodes: allNodes, flowContext: globalFlowContext } = storeState;

            // 1. Collect variables (handles mockData internally if provided)
            // If mockData is present, allVariables will contain ONLY mock data (debug mode behavior)
            const allVariables = collectVariables(context, globalFlowContext, allNodes, mockData);

            // 2. Prepare Prompts
            let prompt = nodeData.prompt || "";
            let negativePrompt = nodeData.negativePrompt || "";

            // Handle direct Debug Override (when user types directly in debug dialog inputs)
            if (mockData) {
                if (typeof mockData.prompt === 'string') {
                    prompt = mockData.prompt;
                }
                if (typeof mockData.negativePrompt === 'string') {
                    negativePrompt = mockData.negativePrompt;
                }
            }

            // 3. Variable Substitution
            // Replace variables in prompt and negativePrompt (supports both normal flow variables and mock variables)
            if (Object.keys(allVariables).length > 0) {
                prompt = replaceVariables(prompt, allVariables);
                negativePrompt = replaceVariables(negativePrompt, allVariables);
            }

            // Get current user for quota tracking
            const user = await authService.getCurrentUser();

            // Get model capabilities
            const { imageGenModelsAPI } = await import("@/services/imageGenModelsAPI");
            const modelInfo = await imageGenModelsAPI.getModelByModelId(modelId);
            const capabilities = modelInfo?.capabilities || DEFAULT_IMAGEGEN_CAPABILITIES;
            const cfgParam = capabilities.cfgParam || null;

            // Apply defaults
            const effectiveCfg = nodeData.cfg ?? nodeData.guidanceScale ?? capabilities.defaultCfg ?? IMAGEGEN_CONFIG.DEFAULT_CFG;
            const effectiveSteps = nodeData.numInferenceSteps ?? capabilities.defaultSteps ?? IMAGEGEN_CONFIG.DEFAULT_STEPS;
            const effectiveImageSize = nodeData.imageSize ?? capabilities.imageSizes?.[0] ?? IMAGEGEN_CONFIG.DEFAULT_IMAGE_SIZE;

            // Resolve reference images
            let image: string | undefined;
            let image2: string | undefined;
            let image3: string | undefined;

            if (nodeData.referenceImageMode === 'variable') {
                // Variable mode: resolve {{variable}} placeholders
                // allVariables is already a flat Record<string, string>, so we can use it directly
                if (nodeData.referenceImageVariable) {
                    const resolved = replaceVariables(nodeData.referenceImageVariable, allVariables);
                    if (isValidImageValue(resolved)) image = resolved;
                }
                if (nodeData.referenceImage2Variable) {
                    const resolved = replaceVariables(nodeData.referenceImage2Variable, allVariables);
                    if (isValidImageValue(resolved)) image2 = resolved;
                }
                if (nodeData.referenceImage3Variable) {
                    const resolved = replaceVariables(nodeData.referenceImage3Variable, allVariables);
                    if (isValidImageValue(resolved)) image3 = resolved;
                }
            } else {
                // Static mode
                image = nodeData.referenceImageUrl;
                image2 = nodeData.referenceImageUrl2;
                image3 = nodeData.referenceImageUrl3;
            }

            // 4. Call Service
            const data = await imageGenService.generateImage({
                model: modelId,
                prompt,
                negativePrompt: capabilities.supportsNegativePrompt ? negativePrompt : undefined,
                imageSize: capabilities.supportsImageSize !== false ? effectiveImageSize : undefined,
                cfg: capabilities.cfgParam ? effectiveCfg : undefined,
                cfgParam,
                numInferenceSteps: effectiveSteps,
                image,
                image2,
                image3,
                capabilities: {
                    supportsNegativePrompt: capabilities.supportsNegativePrompt ?? false,
                    supportsImageSize: capabilities.supportsImageSize ?? true,
                    supportsReferenceImage: capabilities.supportsReferenceImage ?? false,
                    supportsInferenceSteps: capabilities.supportsInferenceSteps ?? false,
                }
            });

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
    private async checkQuota(modelId?: string): Promise<ExecutionResult | null> {
        try {
            const user = await authService.getCurrentUser();
            if (!user) {
                return {
                    output: { error: "请先登录以使用图片生成功能" },
                    executionTime: 0,
                };
            }

            const requiredPoints = await quotaService.getImageGenPointsCost(modelId);
            const pointsCheck = await quotaService.checkPoints(user.id, requiredPoints);
            if (!pointsCheck.allowed) {
                return {
                    output: { error: `积分不足，当前余额 ${pointsCheck.balance}，需要 ${pointsCheck.required}。请联系管理员增加积分。` },
                    executionTime: 0,
                };
            }
        } catch {
            return {
                output: { error: "积分检查失败，请稍后重试" },
                executionTime: 0,
            };
        }
        return null;
    }
}
