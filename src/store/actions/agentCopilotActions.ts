import { normalizePlan } from "../utils/planNormalizer";
import type { Plan } from "@/types/plan";
import { calculateOptimalLayout } from "../utils/layoutAlgorithm";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { trackAgentStart, trackAgentComplete, trackCopilotPlanConfirm, trackCopilotPlanAdjust } from "@/lib/trackingService";
import { useQuotaStore } from "@/store/quotaStore";
import type { SSEEvent, FeedItem } from "@/types/flow";
import {
    handleThinkingStart,
    handleThinking,
    handleThinkingEnd,
    handleToolCall,
    handleToolResult,
    handleSuggestion,
    handleStep,
    handleClarification,
    handlePlan,
    updatePlanStatus
} from "../utils/feedReducers";
import { validateFlowStructure } from "../utils/flowValidation";

export const createAgentCopilotActions = (set: any, get: any) => ({
    /**
     * 使用 Agent API 生成 Flow (带思维链可视化)
     * 
     * 与 startCopilot 的区别:
     * - 调用 /api/agent/plan 而非 /api/plan
     * - 发送 SSE 事件给 AgentCopilotOverlay 展示思维链
     * - 其他逻辑 (配额检查、保存、布局优化) 保持不变
     */
    startAgentCopilot: async (prompt: string, options?: { enableClarification?: boolean; force?: boolean; preserveFeed?: boolean }) => {
        // CONCURRENCY GUARD: Prevent duplicate execution (fixing double-step issue in Strict Mode)
        // If force is true, we bypass this check (used when restarting from a confirmed state)
        if (get().copilotStatus === "thinking" && !options?.force) {
            console.warn("[Agent] Skipped duplicate execution request");
            return;
        }

        // UX OPTIMIZATION: Show "Analysis" step immediately to prevent "Loading..." gap
        // FIX: Move this to the TOP to prevent flash of old content during async checks
        // When preserveFeed is true (e.g., after confirmPlan or adjustPlan), keep existing feed content
        const existingFeed = options?.preserveFeed ? get().copilotFeed : [];

        // Determine the next step ID and type based on context
        const isAdjustment = options?.preserveFeed && existingFeed.some((f: FeedItem) => f.type === 'plan');
        const nextStepId = isAdjustment ? `adjustment-thinking-${Date.now()}` : `init-analysis-${Date.now()}`;

        const initialFeedItem: FeedItem = {
            id: nextStepId,
            type: 'step',
            stepType: 'analysis', // Always use 'analysis' to match backend Phase 1 output
            status: 'streaming',
            content: isAdjustment ? '正在根据您的反馈优化方案...' : '',
            timestamp: Date.now()
        };

        const newFeed = options?.preserveFeed
            ? [...existingFeed, initialFeedItem]
            : [initialFeedItem];

        // IMMEDIATE STATE RESET: Clear old data instantly
        set({
            copilotStatus: "thinking",
            copilotMode: "agent",
            copilotStep: isAdjustment ? get().copilotStep + 1 : 1, // Increment step for adjustments
            copilotFeed: newFeed,
            currentCopilotPrompt: prompt,
            error: null // Clear any previous errors
        });

        // 埋点：Agent 开始
        trackAgentStart('agent', prompt.length);

        // QUOTA CHECK: Verify user has remaining quota
        let user: Awaited<ReturnType<typeof authService.getCurrentUser>> = null;

        try {
            user = await authService.getCurrentUser();

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

            if (errorMsg.includes("已用完") || errorMsg.includes("登录")) {
                throw e;
            }

            set({
                copilotStatus: "idle",
                error: "配额检查失败，请稍后重试"
            });
            throw new Error("配额检查失败，请稍后重试");
        }

        // PERSISTENCE: Mark that copilot is running
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('flash-flow:copilot-operation', 'generating');
        }

        try {
            const ownerId = user!.id;

            // ========== 调用 Agent API ==========
            const resp = await fetch("/api/agent/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, ownerId, enableClarification: options?.enableClarification }),
            });

            if (!resp.body) {
                throw new Error("No response body");
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let plan: Plan = { nodes: [], edges: [] };
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") continue;

                        try {
                            const parsed = JSON.parse(data) as SSEEvent;

                            // ========== 使用 feedReducers 更新 Store Feed State ==========
                            set((state: { copilotFeed: FeedItem[]; copilotStep: number }) => {
                                let newFeed = state.copilotFeed;
                                let newStep = state.copilotStep;

                                switch (parsed.type) {
                                    case "thinking-start":
                                        newStep = 1;
                                        newFeed = handleThinkingStart(newFeed);
                                        break;

                                    case "thinking":
                                        newFeed = handleThinking(newFeed, parsed.content || "");
                                        break;

                                    case "thinking-end":
                                        newFeed = handleThinkingEnd(newFeed);
                                        break;

                                    case "tool-call":
                                        newStep = 2;
                                        if (parsed.tool) {
                                            newFeed = handleToolCall(newFeed, parsed.tool);
                                        }
                                        break;

                                    case "tool-result":
                                        newStep = 3;
                                        if (parsed.tool) {
                                            newFeed = handleToolResult(newFeed, parsed.tool, parsed.result);
                                        }
                                        break;

                                    // case "suggestion":
                                    //     if (parsed.content) {
                                    //         newFeed = handleSuggestion(newFeed, parsed.content, parsed.scenario);
                                    //     }
                                    //     break;

                                    case "step":
                                        if (parsed.stepType && parsed.content) {
                                            newFeed = handleStep(
                                                newFeed,
                                                parsed.stepType,
                                                parsed.status as 'streaming' | 'completed' || 'streaming',
                                                parsed.content
                                            );
                                        }
                                        break;

                                    case "clarification":
                                        if (parsed.questions) {
                                            // 🛡️ SECURITY: If clarification is disabled (explicitly false), ignore backend requests
                                            if (options?.enableClarification === false) {
                                                console.warn("[Agent] Clarification ignored due to disabled settings");
                                                // Add a thought to the feed to indicate what happened (visible in chain of thought)
                                                newFeed = handleThinking(newFeed, "\n[System] Detcted clarification request but skipped it (Auto-mode active). Continuing...");
                                            } else {
                                                newFeed = handleClarification(newFeed, parsed.questions);
                                                // Important: Set status to awaiting_input so UI stays open and interactive
                                                set({ copilotStatus: "awaiting_input" });
                                            }
                                        }
                                        break;

                                    case "plan":
                                        if (parsed.steps && parsed.userPrompt) {
                                            newFeed = handlePlan(newFeed, parsed.userPrompt, parsed.steps, {
                                                refinedIntent: parsed.refinedIntent,
                                                workflowNodes: parsed.workflowNodes,
                                                useCases: parsed.useCases,
                                                howToUse: parsed.howToUse
                                            });
                                            // Set status to awaiting_plan_confirm so UI shows plan preview card
                                            set({ copilotStatus: "awaiting_plan_confirm" });
                                        }
                                        break;
                                }

                                return { copilotFeed: newFeed, copilotStep: newStep };
                            });

                            // 提取最终结果
                            if (parsed.type === "result") {
                                plan = {
                                    title: parsed.title,
                                    nodes: parsed.nodes as any || [],
                                    edges: parsed.edges as any || [],
                                };
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }


            // Bug #6 fix: 处理 buffer 中剩余的未解析内容
            if (buffer.trim() && buffer.startsWith("data: ")) {
                const data = buffer.slice(6).trim();
                if (data && data !== "[DONE]") {
                    try {
                        const parsed = JSON.parse(data) as SSEEvent;
                        if (parsed.type === "result") {
                            plan = {
                                title: parsed.title,
                                nodes: parsed.nodes as any || [],
                                edges: parsed.edges as any || [],
                            };
                        }
                    } catch {
                        // Ignore parse errors for incomplete data
                    }
                }
            }

            // CRITICAL FIX: If clarification or plan confirmation was triggered, we must NOT proceed to completion
            // The handlers already set copilotStatus to "awaiting_input" or "awaiting_plan_confirm"
            // We need to return early to preserve that state and let user interact with the UI
            const currentStatus = get().copilotStatus;
            if (currentStatus === "awaiting_input" || currentStatus === "awaiting_plan_confirm") {
                console.log(`[Agent] Interruption detected (status: ${currentStatus}), preserving state`);
                return; // Early exit - do not overwrite to "completed"
            }

            const { nodes, edges } = normalizePlan(plan, prompt);

            const title = plan.title || prompt.slice(0, 30) || "Generated Flow";

            // ========== Phase 4b: Auto Validation ==========
            const validation = validateFlowStructure(nodes, edges);

            // Add validation step to feed
            set((state: { copilotFeed: FeedItem[] }) => ({
                copilotFeed: handleStep(
                    state.copilotFeed,
                    "validation",
                    validation.valid ? "completed" : "error",
                    validation.valid
                        ? "✅ 逻辑校验通过"
                        : `⚠️ 验证发现问题:\n${validation.errors.join("\n")}${validation.warnings.length > 0 ? "\n警告: " + validation.warnings.join(", ") : ""}`,
                    true // Force update existing validation step from backend
                )
            }));

            // Log validation results for debugging
            if (!validation.valid) {
                console.warn("[Agent] Flow validation failed:", validation.errors);
            }
            if (validation.warnings.length > 0) {
                console.info("[Agent] Flow validation warnings:", validation.warnings);
            }
            // ========== End Auto Validation ==========

            // Reset execution state
            get().resetExecution();

            // Optimize layout first (pure calculation)
            const optimizedNodes = calculateOptimalLayout(nodes, edges);

            // CRITICAL FIX: Batch all state updates into ONE set() call to prevent flicker
            // Before: 3 separate set() calls caused rapid re-renders and UI flicker
            // After: Single atomic batch update
            set({
                nodes: optimizedNodes,
                edges,
                flowTitle: title,
                currentFlowId: null  // Reset to ensure NEW flow is created
            });

            // Flush save to get flowId immediately
            await get().flushSave();

            // Refresh quota UI
            try {
                if (user) {
                    const { refreshQuota } = useQuotaStore.getState();
                    await refreshQuota(user.id);
                }
            } catch {
                // Quota UI refresh failed - non-critical
            }

            set({ copilotStatus: "completed" });

            // 埋点：Agent 完成
            trackAgentComplete(get().copilotFeed.length, 0);
        } catch (error) {
            // Bug Fix #4 (Enhanced): Do NOT clear copilotFeed to prevent "Blank Canvas" crash.
            // Instead, mark status as completed (to keep overlay open) and add error step.
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Agent Copilot Error:", error);

            // Add error step to feed so user sees what happened
            set((state: { copilotFeed: FeedItem[] }) => ({
                copilotStatus: "completed", // Keep overlay open so user can see error
                copilotFeed: handleStep(
                    state.copilotFeed,
                    "error",
                    "error",
                    `❌ 生成过程中发生错误:\n${errorMessage}\n\n请尝试重试或修改提示词。`
                )
            }));
        } finally {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('flash-flow:copilot-operation');
            }
        }
    },

    submitClarification: async (originalPrompt: string, answers: string[]) => {
        const answerText = answers.map((a, i) => `Answer ${i + 1}: ${a}`).join('\n');
        // Construct a richer prompt that includes conversation history context
        const newPrompt = `Original Request: ${originalPrompt}\n\nUser Clarifications:\n${answerText}\n\nPlease generate the workflow now based on the original request and these clarifications.`;

        // Restart copilot with new prompt, disabling clarification to avoid loops
        await get().startAgentCopilot(newPrompt, { enableClarification: false });
    },

    /**
     * 确认任务规划，继续生成工作流
     */
    confirmPlan: async () => {
        const { copilotFeed, currentCopilotPrompt } = get();

        // Update plan status to confirmed
        set((state: { copilotFeed: FeedItem[] }) => ({
            copilotFeed: updatePlanStatus(state.copilotFeed, 'confirmed'),
            copilotStatus: 'thinking'
        }));

        // Continue with the original prompt (agent will see plan was confirmed)
        if (currentCopilotPrompt) {
            // In a full implementation, we would call the backend to continue generation
            // For now, we restart with a signal that plan is confirmed
            const confirmedPrompt = `[PLAN_CONFIRMED]\n${currentCopilotPrompt}`;

            // 埋点：确认计划
            const planItem = copilotFeed.find((f: FeedItem) => f.type === 'plan');
            trackCopilotPlanConfirm(planItem ? (planItem as import('@/types/flow').PlanItem).steps.length : 0);

            await get().startAgentCopilot(confirmedPrompt, { enableClarification: false, force: true, preserveFeed: true });
        }
    },

    /**
     * 调整任务规划，带用户反馈重新生成
     */
    adjustPlan: async (feedback: string) => {
        const { currentCopilotPrompt, copilotFeed } = get();

        // Update plan status to adjusting
        set((state: { copilotFeed: FeedItem[] }) => ({
            copilotFeed: updatePlanStatus(state.copilotFeed, 'adjusting'),
            copilotStatus: 'thinking'
        }));

        // Find the last plan to include its steps in context
        let planSteps = '';
        for (let i = copilotFeed.length - 1; i >= 0; i--) {
            if (copilotFeed[i].type === 'plan') {
                const planItem = copilotFeed[i] as import('@/types/flow').PlanItem;
                planSteps = planItem.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
                break;
            }
        }

        // Construct adjusted prompt
        const adjustedPrompt = `Original Request: ${currentCopilotPrompt}

Previous Plan:
${planSteps}

User Feedback for Adjustment:
${feedback}

Please regenerate the workflow plan based on the user's feedback.`;

        // 埋点：调整计划
        trackCopilotPlanAdjust();

        // Restart copilot with adjusted prompt, preserving feed history
        await get().startAgentCopilot(adjustedPrompt, {
            enableClarification: true,
            force: true,
            preserveFeed: true // <--- CRITICAL: Keep history for context
        });
    }
});
