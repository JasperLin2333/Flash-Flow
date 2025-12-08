import { normalizePlan } from "../utils/planNormalizer";
import type { Plan } from "@/types/plan";
import { calculateOptimalLayout } from "../utils/layoutAlgorithm";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { useQuotaStore } from "@/store/quotaStore";

export const createCopilotActions = (set: any, get: any) => ({
    /**
     * CRITICAL FIX: Use AI to generate Flow with proper state synchronization
     * 
     * TIMING FIX: Now uses flushSave() instead of scheduleSave() to immediately
     * get the flowId, avoiding race condition where URL update tried to read
     * currentFlowId before save completed.
     * 
     * PERSISTENCE: Uses sessionStorage to persist copilot operation state,
     * allowing recovery if user refreshes during generation.
     * 
     * QUOTA: Checks and enforces flow generation quota limits
     */
    startCopilot: async (prompt: string) => {
        // QUOTA CHECK: Verify user has remaining quota
        // Declare user outside try-catch so it's available for ownerId below
        let user: Awaited<ReturnType<typeof authService.getCurrentUser>> = null;

        try {
            user = await authService.getCurrentUser();

            // Require authentication for flow generation
            if (!user) {
                set({
                    copilotStatus: "idle",
                    error: "请先登录以生成 Flow"
                });
                throw new Error("请先登录以生成 Flow");
            }

            // Check quota availability
            const quotaCheck = await quotaService.checkQuota(user.id, "flow_generations");
            if (!quotaCheck.allowed) {
                const errorMsg = `Flow 生成次数已用完 (${quotaCheck.used}/${quotaCheck.limit})。请联系管理员增加配额。`;
                set({
                    copilotStatus: "idle",
                    error: errorMsg
                });
                throw new Error(errorMsg);
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error("[copilot] Quota check failed:", errorMsg);

            // Re-throw if it's a quota-related error
            if (errorMsg.includes("已用完") || errorMsg.includes("登录")) {
                throw e;
            }

            // SECURITY FIX: Fail fast for other errors instead of degraded mode
            set({
                copilotStatus: "idle",
                error: "配额检查失败，请稍后重试"
            });
            throw new Error("配额检查失败，请稍后重试");
        }

        // PERSISTENCE: Mark that copilot is running (for refresh recovery)
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('flash-flow:copilot-operation', 'generating');
        }

        // user is guaranteed non-null here (validated above)
        set({ copilotStatus: "thinking", copilotStep: 0 });

        try {
            const ownerId = user.id;
            const resp = await fetch("/api/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, ownerId }),
            });
            const plan = await resp.json() as Plan;

            const { nodes, edges } = normalizePlan(plan, prompt);
            const title = plan.title || prompt.slice(0, 30) || "Generated Flow";

            // CRITICAL FIX: Reset execution state before applying new flow
            // WHY: Prevents old node outputs from persisting if node IDs collide (e.g. input_1)
            get().resetExecution();

            // CRITICAL FIX: Reset currentFlowId to null to ensure a NEW flow is created
            // WHY: If user had previously opened a flow, not resetting this would cause
            // the new generated content to OVERWRITE the existing flow instead of creating new one
            set({ nodes, edges, flowTitle: title, currentFlowId: null });

            // Optimize layout
            const optimizedNodes = calculateOptimalLayout(nodes, edges);
            set({ nodes: optimizedNodes });

            // CRITICAL FIX: Use flushSave instead of scheduleSave
            // WHY: We need the flowId immediately to update URL, can't wait 800ms debounce
            // ASYNC CHAIN: Wait for save to complete and get the ID
            await get().flushSave();

            // ✅ BUG FIX #3: Track AND refresh quota after successful flow generation
            // DEFENSIVE: Comprehensive error handling with user feedback
            try {
                // Reuse validated user from quota check (no need to fetch again)
                if (user) {
                    const updated = await quotaService.incrementUsage(user.id, "flow_generations");
                    if (!updated) {
                        console.warn("[copilot] Failed to increment quota - quota service returned null");
                    } else {
                        // Automatically refresh quota in UI
                        const { refreshQuota } = useQuotaStore.getState();
                        await refreshQuota(user.id);
                    }
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error("[copilot] Failed to increment quota:", errorMsg);
                // DEFENSIVE: We don't fail the flow generation here since it was successful
            }

            set({ copilotStatus: "completed" });
        } catch (error) {
            console.error('Copilot generation failed:', error);
            set({ copilotStatus: "idle" });
        } finally {
            // CLEANUP: Remove copilot operation flag
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('flash-flow:copilot-operation');
            }
        }
    },

    /**
     * 设置 Copilot 背景样式
     */
    setCopilotBackdrop: (backdrop: "blank" | "overlay") => set({ copilotBackdrop: backdrop }),

    /**
     * 设置 Copilot 状态
     */
    setCopilotStatus: (status: "idle" | "thinking" | "completed") => set({ copilotStatus: status }),

    optimizeLayout: () => {
        const { nodes, edges } = get();
        const optimizedNodes = calculateOptimalLayout(nodes, edges);
        set({ nodes: optimizedNodes });
    },
});
