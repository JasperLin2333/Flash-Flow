/**
 * Edge Runtime Quota Utility
 * 
 * Provides server-side quota checking for Edge Runtime API routes.
 * Uses Supabase to verify quota before allowing API calls.
 */

import { createEdgeClient } from "./authEdge";
import type { PointsActionType } from "@/types/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

interface PointsCheckResult {
    allowed: boolean;
    required: number;
    balance: number;
    remaining: number;
}

/**
 * Check user quota with a provided Supabase client
 */
export async function checkPointsWithClient(
    supabase: SupabaseClient<Database>,
    userId: string,
    actionType: PointsActionType,
    itemKey?: string | null
): Promise<PointsCheckResult> {
    try {
        const { data: quota, error } = await supabase
            .from("users_quota")
            .select("points_balance")
            .eq("user_id", userId)
            .single();

        if (error || !quota) {
            return { allowed: false, required: 0, balance: 0, remaining: 0 };
        }

        const required = await getPointsCostOnServer(supabase, actionType, itemKey);
        const balance = (quota as { points_balance?: number | null }).points_balance ?? 0;
        const remaining = balance - required;

        return {
            allowed: remaining >= 0,
            required,
            balance,
            remaining,
        };
    } catch (e) {
        return { allowed: false, required: 0, balance: 0, remaining: 0 };
    }
}

/**
 * Check user quota on the server side (Edge Runtime)
 */
export async function checkPointsOnServer(
    request: Request,
    userId: string,
    actionType: PointsActionType,
    itemKey?: string | null
): Promise<PointsCheckResult> {
    if (process.env.NODE_ENV === 'development') {
        const testUserHeader = request.headers.get("x-flash-test-user");
        if (testUserHeader) {
            return { allowed: true, required: 0, balance: 9999, remaining: 9999 };
        }
    }

    const supabase = createEdgeClient(request);
    return checkPointsWithClient(supabase, userId, actionType, itemKey);
}

/**
 * Increment quota usage with a provided Supabase client
 */
export async function deductPointsWithClient(
    supabase: SupabaseClient<Database>,
    userId: string,
    actionType: PointsActionType,
    itemKey?: string | null,
    title?: string
): Promise<boolean> {
    const maxRetries = 3;

    try {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Fetch current quota with timestamp for optimistic locking
            const { data: quota, error: fetchError } = await supabase
                .from("users_quota")
                .select("points_balance,points_used,updated_at")
                .eq("user_id", userId)
                .single();

            if (fetchError || !quota) {
                return false;
            }

            const currentBalance = (quota as { points_balance?: number | null }).points_balance ?? 0;
            const currentUsed = (quota as { points_used?: number | null }).points_used ?? 0;
            const required = await getPointsCostOnServer(supabase, actionType, itemKey);
            if (currentBalance < required) {
                return false;
            }

            const updatedAt = (quota as { updated_at?: string | null }).updated_at;
            if (!updatedAt) {
                return false;
            }

            const newBalance = currentBalance - required;
            const newUsed = currentUsed + required;

            // Try to update with optimistic locking
            const { error: updateError } = await supabase
                .from("users_quota")
                .update({
                    points_balance: newBalance,
                    points_used: newUsed,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId)
                .eq("updated_at", updatedAt);

            if (!updateError) {
                await supabase
                    .from("points_ledger")
                    .insert({
                        user_id: userId,
                        action_type: actionType,
                        item_key: itemKey || null,
                        title: title || getPointsTitle(actionType),
                        points: required,
                        balance_after: newBalance
                    });
                return true;
            }

            // Retry on conflict
            if (attempt < maxRetries - 1) {
                await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
            }
        }

        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Increment quota usage on the server side (Edge Runtime)
 */
export async function deductPointsOnServer(
    request: Request,
    userId: string,
    actionType: PointsActionType,
    itemKey?: string | null,
    title?: string
): Promise<boolean> {
    const supabase = createEdgeClient(request);
    return deductPointsWithClient(supabase, userId, actionType, itemKey, title);
}

/**
 * Create a 429 Too Many Requests response for quota exceeded
 */
export function quotaExceededResponse(used: number, limit: number, quotaLabel = "配额") {
    return new Response(
        JSON.stringify({
            error: `${quotaLabel}已用完 (${used}/${limit})`,
            code: "QUOTA_EXCEEDED",
        }),
        {
            status: 429,
            headers: { "Content-Type": "application/json" },
        }
    );
}

export function pointsExceededResponse(balance: number, required: number) {
    return new Response(
        JSON.stringify({
            error: `积分不足，当前余额 ${balance}，需要 ${required}`,
            code: "POINTS_EXCEEDED",
        }),
        {
            status: 429,
            headers: { "Content-Type": "application/json" },
        }
    );
}

// ============ Helper Functions ============

function getPointsCost(actionType: PointsActionType, itemKey?: string | null): number {
    switch (actionType) {
        case "llm":
            return getLLMPointsCost(itemKey || undefined);
        case "flow_generation":
            return 6;
        case "app_usage":
            return 4;
        case "image_generation":
            return 12;
        case "rag_search":
            return getLLMPointsCost("gemini-3-pro-preview");
        case "tool_usage":
            if (itemKey === "web_search") return 5;
            if (itemKey === "code_interpreter") return 10;
            if (itemKey === "url_reader") return 3;
            return 0;
    }
}

async function getPointsCostOnServer(
    supabase: ReturnType<typeof createEdgeClient>,
    actionType: PointsActionType,
    itemKey?: string | null
): Promise<number> {
    switch (actionType) {
        case "llm":
            return await getLLMPointsCostFromDb(supabase, itemKey || undefined);
        case "flow_generation":
            return 6;
        case "app_usage":
            return 4;
        case "image_generation":
            return 12;
        case "rag_search":
            return await getLLMPointsCostFromDb(supabase, "gemini-3-pro-preview");
        case "tool_usage":
            if (itemKey === "web_search") return 5;
            if (itemKey === "code_interpreter") return 10;
            if (itemKey === "url_reader") return 3;
            return 0;
    }
}

async function getLLMPointsCostFromDb(
    supabase: ReturnType<typeof createEdgeClient>,
    modelId?: string
): Promise<number> {
    const fallback = getLLMPointsCost(modelId);
    if (!modelId) {
        return fallback;
    }

    const { data, error } = await supabase
        .from("llm_models")
        .select("points_cost")
        .eq("model_id", modelId)
        .single();

    if (error || !data) {
        return fallback;
    }

    const points = (data as { points_cost?: number | null }).points_cost;
    return typeof points === "number" ? points : fallback;
}

function getLLMPointsCost(modelId?: string): number {
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
}

function getPointsTitle(actionType: PointsActionType): string {
    switch (actionType) {
        case "llm":
            return "LLM 使用";
        case "flow_generation":
            return "Flow 生成";
        case "app_usage":
            return "App 使用";
        case "image_generation":
            return "图片生成";
        case "rag_search":
            return "RAG 检索";
        case "tool_usage":
            return "工具使用";
    }
}
