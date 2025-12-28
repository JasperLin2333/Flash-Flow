/**
 * Image Generation API Route
 * 
 * Calls SiliconFlow's image generation API and uploads result to Supabase Storage.
 * Supports models: FLUX.1-schnell, Kolors, Stable Diffusion 3.5
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// SiliconFlow API Configuration
const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/images/generations";

// Supabase Storage Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STORAGE_BUCKET = "generated-images";

/**
 * Request body for image generation API
 * 
 * Field Mapping (Frontend → Backend → SiliconFlow API):
 * - prompt → prompt → prompt
 * - negativePrompt → negativePrompt → negative_prompt
 * - imageSize → imageSize → image_size
 * - cfg → cfg → guidance_scale/cfg (based on cfgParam)
 * - numInferenceSteps → numInferenceSteps → num_inference_steps
 * - referenceImageUrl → image → image
 * - referenceImageUrl2 → image2 → image2
 * - referenceImageUrl3 → image3 → image3
 */
interface GenerateImageRequest {
    model: string;
    prompt: string;
    negativePrompt?: string;
    imageSize?: string;
    cfg?: number;                        // 统一 CFG 值
    cfgParam?: 'guidance_scale' | 'cfg'; // 指定使用哪个参数名
    numInferenceSteps?: number;          // 推理步数
    userId?: string;
    // 参考图 (图生图) - 前端字段名: referenceImageUrl/2/3
    // SiliconFlow API 期望: image/image2/image3
    image?: string;   // 对应前端 referenceImageUrl (主参考图 URL)
    image2?: string;  // 对应前端 referenceImageUrl2 (第二张参考图, 仅 Edit-2509)
    image3?: string;  // 对应前端 referenceImageUrl3 (第三张参考图, 仅 Edit-2509)
}

interface SiliconFlowResponse {
    images: { url: string }[];
    timings?: { inference: number };
    seed?: number;
}

export async function POST(req: NextRequest) {
    try {
        const body: GenerateImageRequest = await req.json();
        const { model, prompt, negativePrompt, imageSize, cfg, cfgParam, numInferenceSteps, userId, image, image2, image3 } = body;

        // Validate required fields
        if (!prompt) {
            return NextResponse.json(
                { error: "Prompt is required" },
                { status: 400 }
            );
        }

        // Check quota if userId provided - use server-side client
        if (userId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
            const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            const { data: quotaData, error: quotaError } = await supabaseAdmin
                .from("users_quota")
                .select("image_gen_executions_used, image_gen_executions_limit")
                .eq("user_id", userId)
                .single();

            if (quotaError) {
                console.error("[generate-image] Quota check error:", quotaError);
                // Allow if quota check fails (graceful degradation)
            } else if (quotaData) {
                const used = (quotaData as Record<string, number>).image_gen_executions_used ?? 0;
                const limit = (quotaData as Record<string, number>).image_gen_executions_limit ?? 20;

                if (used >= limit) {
                    return NextResponse.json(
                        { error: `图片生成次数已用完 (${used}/${limit})` },
                        { status: 429 }
                    );
                }
            }
        }

        // Get API key
        const apiKey = process.env.SILICONFLOW_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "SiliconFlow API key not configured" },
                { status: 500 }
            );
        }

        // Build request body dynamically based on model capabilities
        const requestBody: Record<string, unknown> = {
            model: model || "Kwai-Kolors/Kolors",
            prompt,
            batch_size: 1,
        };

        // Add negative prompt if provided
        if (negativePrompt) {
            requestBody.negative_prompt = negativePrompt;
        }

        // Add image size only if provided (some models don't support it)
        if (imageSize) {
            requestBody.image_size = imageSize;
        }

        // Add CFG value with correct parameter name based on model
        if (cfg !== undefined && cfgParam) {
            requestBody[cfgParam] = cfg;
        }

        // Add inference steps if provided
        if (numInferenceSteps) {
            requestBody.num_inference_steps = numInferenceSteps;
        }

        // Add reference images (for img2img models)
        if (image) {
            requestBody.image = image;
        }
        if (image2) {
            requestBody.image2 = image2;
        }
        if (image3) {
            requestBody.image3 = image3;
        }

        // Call SiliconFlow API
        const siliconFlowResponse = await fetch(SILICONFLOW_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!siliconFlowResponse.ok) {
            const errorText = await siliconFlowResponse.text();
            console.error("[generate-image] SiliconFlow API error:", errorText);
            return NextResponse.json(
                { error: `图片生成失败: ${siliconFlowResponse.status}` },
                { status: siliconFlowResponse.status }
            );
        }

        const result: SiliconFlowResponse = await siliconFlowResponse.json();

        if (!result.images || result.images.length === 0) {
            return NextResponse.json(
                { error: "No image generated" },
                { status: 500 }
            );
        }

        const generatedImageUrl = result.images[0].url;

        // Upload to Supabase Storage for persistence
        let persistedUrl = generatedImageUrl;
        try {
            if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
                const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

                // Download image from SiliconFlow
                const imageResponse = await fetch(generatedImageUrl);
                const imageBlob = await imageResponse.blob();
                const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

                // Generate unique filename
                const timestamp = Date.now();
                const randomSuffix = Math.random().toString(36).substring(2, 8);
                const fileName = `${timestamp}_${randomSuffix}.png`;

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .upload(fileName, imageBuffer, {
                        contentType: "image/png",
                        upsert: false,
                    });

                if (uploadError) {
                    console.warn("[generate-image] Storage upload failed:", uploadError);
                    // Fall back to original URL
                } else {
                    // Get public URL
                    const { data: publicUrlData } = supabase.storage
                        .from(STORAGE_BUCKET)
                        .getPublicUrl(fileName);

                    persistedUrl = publicUrlData.publicUrl;
                }
            }
        } catch (storageError) {
            console.warn("[generate-image] Storage error, using original URL:", storageError);
        }

        // Increment quota usage - use server-side client
        if (userId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
            const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            const { data: currentQuota } = await supabaseAdmin
                .from("users_quota")
                .select("image_gen_executions_used")
                .eq("user_id", userId)
                .single();

            const currentUsed = (currentQuota as Record<string, number> | null)?.image_gen_executions_used ?? 0;

            await supabaseAdmin
                .from("users_quota")
                .update({ image_gen_executions_used: currentUsed + 1 })
                .eq("user_id", userId);
        }

        return NextResponse.json({
            success: true,
            imageUrl: persistedUrl,
            originalUrl: generatedImageUrl,
            seed: result.seed,
            prompt,
        });

    } catch (error) {
        console.error("[generate-image] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
