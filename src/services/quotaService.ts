/**
 * Quota Service
 * Handles user quota management and usage tracking
 */

import { supabase } from "@/lib/supabase";
import type { UserQuota, QuotaType, QuotaCheckResult, PointsCheckResult, PointsLedgerEntry, PointsActionType } from "@/types/auth";

export const quotaService = {
    /**
     * Get user quota information
     */
    async getUserQuota(userId: string): Promise<UserQuota | null> {
        try {
            const { data, error } = await supabase
                .from("users_quota")
                .select("*")
                .eq("user_id", userId)
                .single();

            if (error) {
                console.error("[quotaService] getUserQuota error:", error);
                return null;
            }

            // Debug: log raw data to see what Supabase returns
            console.log("[quotaService] Raw quota data:", JSON.stringify(data, null, 2));

            // Cast to Record to access potentially new fields that aren't in generated types yet
            const rawData = data as Record<string, unknown>;

            // Type assertion with fallback for new fields
            // This handles the case where Supabase types haven't been regenerated after migration
            const quota: UserQuota = {
                id: rawData.id as string,
                user_id: rawData.user_id as string,
                llm_executions_used: rawData.llm_executions_used as number,
                llm_executions_limit: rawData.llm_executions_limit as number,
                flow_generations_used: rawData.flow_generations_used as number,
                flow_generations_limit: rawData.flow_generations_limit as number,
                app_usages_used: rawData.app_usages_used as number,
                app_usages_limit: rawData.app_usages_limit as number,
                image_gen_executions_used: (rawData.image_gen_executions_used as number) ?? 0,
                image_gen_executions_limit: (rawData.image_gen_executions_limit as number) ?? 20,
                points_balance: (rawData.points_balance as number) ?? 0,
                points_used: (rawData.points_used as number) ?? 0,
                created_at: rawData.created_at as string,
                updated_at: rawData.updated_at as string,
            };

            return quota;
        } catch (e) {
            console.error("[quotaService] getUserQuota exception:", e);
            return null;
        }
    },

    /**
     * Check if user has remaining quota for a specific type
     */
    async checkQuota(userId: string, quotaType: QuotaType): Promise<QuotaCheckResult> {
        const quota = await this.getUserQuota(userId);

        if (!quota) {
            // If quota record doesn't exist, assume no quota available
            return {
                allowed: false,
                used: 0,
                limit: 0,
                remaining: 0,
            };
        }

        // 类型安全的字段映射
        const { used, limit } = this.getQuotaFields(quota, quotaType);
        const remaining = limit - used;

        return {
            allowed: remaining > 0,
            used,
            limit,
            remaining,
        };
    },

    /**
     * 类型安全的 quota 字段获取
     * 避免使用动态字符串拼接访问对象属性
     */
    getQuotaFields(quota: UserQuota, quotaType: QuotaType): { used: number; limit: number } {
        switch (quotaType) {
            case 'llm_executions':
                return { used: quota.llm_executions_used, limit: quota.llm_executions_limit };
            case 'flow_generations':
                return { used: quota.flow_generations_used, limit: quota.flow_generations_limit };
            case 'app_usages':
                return { used: quota.app_usages_used, limit: quota.app_usages_limit };
            case 'image_gen_executions':
                return { used: quota.image_gen_executions_used, limit: quota.image_gen_executions_limit };
        }
    },

    /**
     * Increment usage count for a specific quota type
     * Returns the updated quota or null if failed
     * 
     * RACE CONDITION FIX: Uses optimistic locking to prevent lost updates
     * under concurrent requests.
     */
    async incrementUsage(userId: string, quotaType: QuotaType): Promise<UserQuota | null> {
        // Use optimistic locking with retry pattern to handle concurrent updates
        return this.incrementUsageFallback(userId, quotaType);
    },

    /**
     * Fallback increment method with optimistic locking
     * Used when atomic SQL increment is not supported
     */
    async incrementUsageFallback(userId: string, quotaType: QuotaType): Promise<UserQuota | null> {
        const maxRetries = 3;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const quota = await this.getUserQuota(userId);
            if (!quota) {
                return null;
            }

            // 类型安全的字段访问
            const { used: currentUsed } = this.getQuotaFields(quota, quotaType);
            const updated_at = quota.updated_at;

            // 构建类型安全的更新对象
            const updatePayload = this.buildIncrementPayload(quotaType, currentUsed + 1);

            // Try to update with optimistic locking (check updated_at hasn't changed)
            const { data, error } = await supabase
                .from("users_quota")
                .update({
                    ...updatePayload,
                    updated_at: new Date().toISOString()
                })
                .eq("user_id", userId)
                .eq("updated_at", updated_at)
                .select()
                .single();

            if (!error && data) {
                // Cast to UserQuota with fallback for new fields
                const rawData = data as Record<string, unknown>;
                const result: UserQuota = {
                    id: rawData.id as string,
                    user_id: rawData.user_id as string,
                    llm_executions_used: rawData.llm_executions_used as number,
                    llm_executions_limit: rawData.llm_executions_limit as number,
                    flow_generations_used: rawData.flow_generations_used as number,
                    flow_generations_limit: rawData.flow_generations_limit as number,
                    app_usages_used: rawData.app_usages_used as number,
                    app_usages_limit: rawData.app_usages_limit as number,
                    image_gen_executions_used: (rawData.image_gen_executions_used as number) ?? 0,
                    image_gen_executions_limit: (rawData.image_gen_executions_limit as number) ?? 20,
                    points_balance: (rawData.points_balance as number) ?? 0,
                    points_used: (rawData.points_used as number) ?? 0,
                    created_at: rawData.created_at as string,
                    updated_at: rawData.updated_at as string,
                };
                return result;
            }

            // If update failed due to concurrent modification, retry
            if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 100 * (attempt + 1))); // Exponential backoff
            }
        }

        return null;
    },

    /**
     * 构建类型安全的增量更新载荷
     */
    buildIncrementPayload(quotaType: QuotaType, newValue: number): Partial<UserQuota> {
        switch (quotaType) {
            case 'llm_executions':
                return { llm_executions_used: newValue };
            case 'flow_generations':
                return { flow_generations_used: newValue };
            case 'app_usages':
                return { app_usages_used: newValue };
            case 'image_gen_executions':
                return { image_gen_executions_used: newValue };
        }
    },

    getLLMPointsCost(modelId?: string): number {
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
    },

    getPointsCost(actionType: PointsActionType, itemKey?: string | null): number {
        switch (actionType) {
            case "llm":
                return this.getLLMPointsCost(itemKey || undefined);
            case "flow_generation":
                return 6;
            case "app_usage":
                return 4;
            case "image_generation":
                return 12;
            case "rag_search":
            return this.getLLMPointsCost("gemini-3-pro-preview");
        case "tool_usage":
            if (itemKey === "web_search") return 5;
            if (itemKey === "code_interpreter") return 10;
            if (itemKey === "url_reader") return 3;
            return 0;
    }
},

    async getImageGenPointsCost(modelId?: string): Promise<number> {
        const fallback = this.getPointsCost("image_generation");
        if (!modelId) {
            return fallback;
        }

        const { data, error } = await supabase
            .from("image_gen_models")
            .select("points_cost")
            .eq("model_id", modelId)
            .single();

        if (error || !data) {
            return fallback;
        }

        const points = (data as { points_cost?: number | null }).points_cost;
        return typeof points === "number" ? points : fallback;
    },

    async checkPoints(userId: string, requiredPoints: number): Promise<PointsCheckResult> {
        const quota = await this.getUserQuota(userId);

        if (!quota) {
            return {
                allowed: false,
                required: requiredPoints,
                balance: 0,
                remaining: 0,
            };
        }

        const remaining = quota.points_balance - requiredPoints;

        return {
            allowed: remaining >= 0,
            required: requiredPoints,
            balance: quota.points_balance,
            remaining,
        };
    },

    async deductPoints(
        userId: string,
        payload: {
            actionType: PointsActionType;
            itemKey?: string | null;
            title: string;
            points: number;
        }
    ): Promise<UserQuota | null> {
        const maxRetries = 3;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const quota = await this.getUserQuota(userId);
            if (!quota) {
                return null;
            }

            if (quota.points_balance < payload.points) {
                return null;
            }

            const updated_at = quota.updated_at;
            const newBalance = quota.points_balance - payload.points;
            const newUsed = quota.points_used + payload.points;

            const { data, error } = await supabase
                .from("users_quota")
                .update({
                    points_balance: newBalance,
                    points_used: newUsed,
                    updated_at: new Date().toISOString()
                })
                .eq("user_id", userId)
                .eq("updated_at", updated_at)
                .select()
                .single();

            if (!error && data) {
                await (supabase as any)
                    .from("points_ledger")
                    .insert({
                        user_id: userId,
                        action_type: payload.actionType,
                        item_key: payload.itemKey || null,
                        title: payload.title,
                        points: payload.points,
                        balance_after: newBalance
                    });

                const rawData = data as Record<string, unknown>;
                const result: UserQuota = {
                    id: rawData.id as string,
                    user_id: rawData.user_id as string,
                    llm_executions_used: rawData.llm_executions_used as number,
                    llm_executions_limit: rawData.llm_executions_limit as number,
                    flow_generations_used: rawData.flow_generations_used as number,
                    flow_generations_limit: rawData.flow_generations_limit as number,
                    app_usages_used: rawData.app_usages_used as number,
                    app_usages_limit: rawData.app_usages_limit as number,
                    image_gen_executions_used: (rawData.image_gen_executions_used as number) ?? 0,
                    image_gen_executions_limit: (rawData.image_gen_executions_limit as number) ?? 20,
                    points_balance: (rawData.points_balance as number) ?? newBalance,
                    points_used: (rawData.points_used as number) ?? newUsed,
                    created_at: rawData.created_at as string,
                    updated_at: rawData.updated_at as string,
                };
                return result;
            }

            if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
            }
        }

        return null;
    },

    async getPointsLedger(userId: string, limit = 10): Promise<PointsLedgerEntry[]> {
        const { data, error } = await (supabase as any)
            .from("points_ledger")
            .select("id,user_id,action_type,item_key,title,points,balance_after,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error || !data) {
            return [];
        }

        return data as unknown as PointsLedgerEntry[];
    },

    /**
     * Reset a specific quota type to 0 (admin function)
     */
    async resetQuota(userId: string, quotaType: QuotaType): Promise<boolean> {
        try {
            // 使用类型安全的方式构建更新载荷
            const updatePayload = this.buildIncrementPayload(quotaType, 0);

            const { error } = await supabase
                .from("users_quota")
                .update(updatePayload)
                .eq("user_id", userId);

            if (error) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    },

    /**
     * Reset all quota types to 0 (admin function)
     */
    async resetAllQuotas(userId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from("users_quota")
                .update({
                    llm_executions_used: 0,
                    flow_generations_used: 0,
                    app_usages_used: 0,
                    image_gen_executions_used: 0,
                })
                .eq("user_id", userId);

            if (error) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    },

    /**
     * Update quota limits (admin function)
     */
    async updateLimits(
        userId: string,
        limits: {
            llm_executions_limit?: number;
            flow_generations_limit?: number;
            app_usages_limit?: number;
        }
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from("users_quota")
                .update(limits)
                .eq("user_id", userId);

            if (error) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    },

    /**
     * Check if quota is running low (< 10%)
     */
    isQuotaLow(used: number, limit: number): boolean {
        if (limit === 0) return false;
        const remaining = limit - used;
        const percentage = (remaining / limit) * 100;
        return percentage < 10;
    },

    /**
     * Get quota percentage used
     */
    getQuotaPercentage(used: number, limit: number): number {
        if (limit === 0) return 0;
        return Math.min((used / limit) * 100, 100);
    },
};
