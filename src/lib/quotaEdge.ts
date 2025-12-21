/**
 * Edge Runtime Quota Utility
 * 
 * Provides server-side quota checking for Edge Runtime API routes.
 * Uses Supabase to verify quota before allowing API calls.
 */

import { createEdgeClient } from "./authEdge";
import type { QuotaType } from "@/types/auth";

interface QuotaCheckResult {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
}

/**
 * Check user quota on the server side
 * Returns quota status including whether the user can proceed
 */
export async function checkQuotaOnServer(
    request: Request,
    userId: string,
    quotaType: QuotaType
): Promise<QuotaCheckResult> {
    try {
        const supabase = createEdgeClient(request);

        const { data: quota, error } = await supabase
            .from("users_quota")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error || !quota) {
            // Fail closed: deny access if quota check fails
            return { allowed: false, used: 0, limit: 0, remaining: 0 };
        }

        // Type-safe field access
        const { used, limit } = getQuotaFields(quota, quotaType);
        const remaining = limit - used;

        return {
            allowed: remaining > 0,
            used,
            limit,
            remaining,
        };
    } catch (e) {
        // Fail closed: deny access on error
        return { allowed: false, used: 0, limit: 0, remaining: 0 };
    }
}

/**
 * Increment quota usage on the server side
 * Uses optimistic locking to prevent race conditions
 */
export async function incrementQuotaOnServer(
    request: Request,
    userId: string,
    quotaType: QuotaType
): Promise<boolean> {
    const maxRetries = 3;

    try {
        const supabase = createEdgeClient(request);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Fetch current quota with timestamp for optimistic locking
            const { data: quota, error: fetchError } = await supabase
                .from("users_quota")
                .select("*")
                .eq("user_id", userId)
                .single();

            if (fetchError || !quota) {
                return false;
            }

            const { used: currentUsed } = getQuotaFields(quota, quotaType);
            const updatePayload = buildIncrementPayload(quotaType, currentUsed + 1);

            // Try to update with optimistic locking
            const { error: updateError } = await supabase
                .from("users_quota")
                .update({
                    ...updatePayload,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId)
                .eq("updated_at", quota.updated_at);

            if (!updateError) {
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

// ============ Helper Functions ============

interface QuotaRow {
    llm_executions_used: number;
    llm_executions_limit: number;
    flow_generations_used: number;
    flow_generations_limit: number;
    app_usages_used: number;
    app_usages_limit: number;
}

function getQuotaFields(quota: QuotaRow, quotaType: QuotaType): { used: number; limit: number } {
    switch (quotaType) {
        case "llm_executions":
            return { used: quota.llm_executions_used, limit: quota.llm_executions_limit };
        case "flow_generations":
            return { used: quota.flow_generations_used, limit: quota.flow_generations_limit };
        case "app_usages":
            return { used: quota.app_usages_used, limit: quota.app_usages_limit };
    }
}

function buildIncrementPayload(quotaType: QuotaType, newValue: number): Partial<QuotaRow> {
    switch (quotaType) {
        case "llm_executions":
            return { llm_executions_used: newValue };
        case "flow_generations":
            return { flow_generations_used: newValue };
        case "app_usages":
            return { app_usages_used: newValue };
    }
}
