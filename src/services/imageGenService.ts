
import { authService } from "./authService";
import { ImageGenModelCapabilities } from "./imageGenModelsAPI";

export interface GenerateImageParams {
    model: string;
    prompt: string;
    negativePrompt?: string;
    imageSize?: string;
    cfg?: number;
    cfgParam?: 'guidance_scale' | 'cfg' | null;
    numInferenceSteps?: number;
    image?: string;
    image2?: string;
    image3?: string;
    capabilities: {
        supportsNegativePrompt: boolean;
        supportsImageSize: boolean;
        supportsReferenceImage: boolean;
        supportsInferenceSteps: boolean;
    };
}

export interface GenerateImageResponse {
    imageUrl: string;
}

export const imageGenService = {
    /**
     * Call the image generation API
     */
    async generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
        const user = await authService.getCurrentUser();

        const response = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...params,
                userId: user?.id,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Image generation failed: ${response.status}`);
        }

        return response.json();
    }
};
