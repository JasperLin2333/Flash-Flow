/**
 * Quota Store
 * Manages user quota state using Zustand
 */

import { create } from "zustand";
import { quotaService } from "@/services/quotaService";
import type { UserQuota, QuotaType } from "@/types/auth";

interface QuotaStore {
    // State
    quota: UserQuota | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchQuota: (userId: string) => Promise<void>;
    checkAndUse: (userId: string, quotaType: QuotaType) => Promise<boolean>;
    refreshQuota: (userId: string) => Promise<void>;
    clearQuota: () => void;
}

export const useQuotaStore = create<QuotaStore>((set, get) => ({
    // Initial State
    quota: null,
    isLoading: false,
    error: null,

    // Fetch user quota
    fetchQuota: async (userId: string) => {
        set({ isLoading: true, error: null });

        try {
            const quota = await quotaService.getUserQuota(userId);

            if (quota) {
                set({ quota, isLoading: false });
            } else {
                set({ error: "无法获取配额信息", isLoading: false });
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "获取配额时发生错误";
            set({ error: errorMsg, isLoading: false });
        }
    },

    // Check quota and increment usage if available
    checkAndUse: async (userId: string, quotaType: QuotaType): Promise<boolean> => {
        try {
            // Check if quota is available
            const checkResult = await quotaService.checkQuota(userId, quotaType);

            if (!checkResult.allowed) {
                // Quota exhausted
                return false;
            }

            // Increment usage
            const updatedQuota = await quotaService.incrementUsage(userId, quotaType);

            if (updatedQuota) {
                set({ quota: updatedQuota });
                return true;
            }

            return false;
        } catch (e) {
            console.error("[quotaStore] checkAndUse error:", e);
            return false;
        }
    },

    // Refresh quota (without loading state)
    refreshQuota: async (userId: string) => {
        try {
            const quota = await quotaService.getUserQuota(userId);
            if (quota) {
                set({ quota });
            }
        } catch (e) {
            console.error("[quotaStore] refreshQuota error:", e);
        }
    },

    // Clear quota state
    clearQuota: () => set({ quota: null, error: null }),
}));
