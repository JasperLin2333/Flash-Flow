/**
 * Quota Service
 * Handles user quota management and usage tracking
 */

import { supabase } from "@/lib/supabase";
import type { UserQuota, QuotaType, QuotaCheckResult } from "@/types/auth";

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
                return null;
            }

            return data;
        } catch (e) {
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
                return data;
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
        }
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
        } catch (e) {
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
                })
                .eq("user_id", userId);

            if (error) {
                return false;
            }

            return true;
        } catch (e) {
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
        } catch (e) {
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
