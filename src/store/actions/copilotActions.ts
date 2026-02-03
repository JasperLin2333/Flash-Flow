import { normalizePlan } from "../utils/planNormalizer";
import type { Plan } from "@/types/plan";
import { calculateOptimalLayout } from "../utils/layoutAlgorithm";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { useQuotaStore } from "@/store/quotaStore";
import { showError } from "@/utils/errorNotify";

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

            const requiredPoints = quotaService.getPointsCost("flow_generation");
            const pointsCheck = await quotaService.checkPoints(user.id, requiredPoints);
            if (!pointsCheck.allowed) {
                const errorMsg = `积分不足，当前余额 ${pointsCheck.balance}，需要 ${pointsCheck.required}。请联系管理员增加积分。`;
                set({
                    copilotStatus: "idle",
                    error: errorMsg
                });
                throw new Error(errorMsg);
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);

            // Re-throw if it's a quota-related error
            if (errorMsg.includes("已用完") || errorMsg.includes("登录")) {
                throw e;
            }

            // SECURITY FIX: Fail fast for other errors instead of degraded mode
            set({
                copilotStatus: "idle",
                error: "积分检查失败，请稍后重试"
            });
            throw new Error("积分检查失败，请稍后重试");
        }

        // PERSISTENCE: Mark that copilot is running (for refresh recovery)
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('flash-flow:copilot-operation', 'generating');
        }

        // user is guaranteed non-null here (validated above)
        set({ copilotStatus: "thinking", copilotMode: "classic", copilotStep: 0 });

        try {
            const ownerId = user.id;
            const enableValidateWorkflow = process.env.NEXT_PUBLIC_FLOW_VALIDATE_WORKFLOW_ENABLED === "true";
            const skipAutomatedValidation = !enableValidateWorkflow;
            const resp = await fetch("/api/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, ownerId, skipAutomatedValidation }),
            });

            // Handle streaming response
            if (!resp.body) {
                throw new Error("No response body");
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let plan: Plan = { nodes: [], edges: [] };

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value, { stream: true });
                    const lines = text.split("\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") break;

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === "result") {
                                    plan = {
                                        title: parsed.title,
                                        nodes: parsed.nodes || [],
                                        edges: parsed.edges || [],
                                    };
                                }
                            } catch {
                                // Ignore parse errors for progress events
                            }
                        }
                    }
                }
            } catch (streamError) {
                console.warn("Stream reading interrupted:", streamError);
                // If we haven't received valid nodes yet, re-throw the error
                if (!plan.nodes || plan.nodes.length === 0) {
                    throw streamError;
                }
                // Otherwise continue with what we have
            }

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

            // ✅ PERF FIX: Server-side already incremented quota in /api/plan
            // Only refresh the UI to reflect the updated quota (no duplicate increment)
            // This eliminates cross-border Supabase request that caused conflicts
            try {
                if (user) {
                    const { refreshQuota } = useQuotaStore.getState();
                    await refreshQuota(user.id);
                }
            } catch {
                // Quota UI refresh failed - non-critical
            }

            set({ copilotStatus: "completed" });
        } catch (error) {
            console.error("Copilot generation failed:", error);
            showError("生成失败", error instanceof Error ? error.message : "请稍后重试");
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
    setCopilotStatus: (status: "idle" | "thinking" | "completed" | "awaiting_input" | "awaiting_plan_confirm") => set({ copilotStatus: status }),

    /**
     * 设置 Copilot Feed (思维链内容)
     */
    setCopilotFeed: (feed: import("@/types/flow").FeedItem[]) => set({ copilotFeed: feed }),

    optimizeLayout: () => {
        const { nodes, edges } = get();
        const optimizedNodes = calculateOptimalLayout(nodes, edges);
        set({ nodes: optimizedNodes });
    },
});
