import { normalizePlan } from "../utils/planNormalizer";
import type { Plan } from "@/types/plan";
import { calculateOptimalLayout } from "../utils/layoutAlgorithm";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import {
    trackAgentStart,
    trackAgentComplete,
    trackCopilotPlanConfirm,
    trackCopilotPlanAdjust,
    trackAgentFailNetwork,
    runQuickDiagnostic
} from "@/lib/trackingService";
import type { SSEEvent, FeedItem } from "@/types/flow";
import {
    handleThinkingStart,
    handleThinking,
    handleThinkingEnd,
    handleToolCall,
    handleToolResult,
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

        const existingFeed = options?.preserveFeed ? get().copilotFeed : [];
        const shouldPreserveFeed = Boolean(options?.preserveFeed);

        const newFeed = shouldPreserveFeed
            ? existingFeed
            : ([{
                id: `init-analysis-${Date.now()}`,
                type: 'step',
                stepType: 'analysis',
                status: 'streaming',
                content: '',
                timestamp: Date.now()
            } as FeedItem]);

        // IMMEDIATE STATE RESET: Clear old data instantly
        set({
            copilotStatus: "thinking",
            copilotMode: "agent",
            copilotStep: shouldPreserveFeed ? get().copilotStep + 1 : 1,
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
                    error: "请先登录后再生成工作流"
                });
                throw new Error("请先登录后再生成工作流");
            }

            const requiredPoints = quotaService.getPointsCost("flow_generation");
            const pointsCheck = await quotaService.checkPoints(user.id, requiredPoints);
            if (!pointsCheck.allowed) {
                const errorMsg = `积分不足：余额 ${pointsCheck.balance}，本次需要 ${pointsCheck.required}。如需提升额度，请联系管理员。`;
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
                error: "配额检查失败，请稍后再试"
            });
            throw new Error("配额检查失败，请稍后再试");
        }

        // PERSISTENCE: Mark that copilot is running
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('flash-flow:copilot-operation', 'generating');
        }

        try {
            const ownerId = user!.id;
            const enableValidateWorkflow = process.env.NEXT_PUBLIC_FLOW_VALIDATE_WORKFLOW_ENABLED === "true";
            const skipAutomatedValidation = !enableValidateWorkflow;

            // A/B testing experiment parameter
            let experimentParam = null;
            if (typeof window !== 'undefined') {
                experimentParam = new URLSearchParams(window.location.search).get('experiment');
            }

            // ========== 调用 Agent API ==========
            const resp = await fetch("/api/agent/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    ownerId,
                    enableClarification: options?.enableClarification,
                    skipAutomatedValidation,
                    experiment: experimentParam
                }),
            });

            if (!resp.body) {
                throw new Error("服务返回异常，请稍后再试");
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
                                            newFeed = handleToolCall(newFeed, parsed.tool, parsed.args);
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
                                        if (parsed.stepType && (parsed.content !== undefined || parsed.status === 'completed')) {
                                            const planAdjustActive = newFeed.some(item =>
                                                item.type === 'step' &&
                                                (item as any).stepType === 'plan_adjust' &&
                                                (item as any).status === 'streaming'
                                            );

                                            if (planAdjustActive && parsed.stepType !== "error") {
                                                if (parsed.status === "streaming" && parsed.content) {
                                                    newFeed = handleStep(
                                                        newFeed,
                                                        "plan_adjust",
                                                        "streaming",
                                                        parsed.content,
                                                        true
                                                    );
                                                }
                                            } else {
                                                newFeed = handleStep(
                                                    newFeed,
                                                    parsed.stepType,
                                                    parsed.status as 'streaming' | 'completed' || 'streaming',
                                                    parsed.content || ""
                                                );
                                            }

                                            if (parsed.stepType === "verification" && parsed.status === "completed") {
                                                const hasResultPrep = newFeed.some(item =>
                                                    item.type === "step" && (item as any).stepType === "result_prep"
                                                );
                                                if (!hasResultPrep) {
                                                    newFeed = handleStep(newFeed, "result_prep", "streaming", "");
                                                }
                                            }
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
                                                newFeed = handleStep(newFeed, "analysis", "completed", "", true);
                                                newFeed = handleClarification(newFeed, parsed.questions);
                                                // Important: Set status to awaiting_input so UI stays open and interactive
                                                set({ copilotStatus: "awaiting_input" });
                                            }
                                        }
                                        break;

                                    case "plan":
                                        if (parsed.steps && parsed.userPrompt) {
                                            const hasPlanAdjust = newFeed.some(item =>
                                                item.type === 'step' &&
                                                (item as any).stepType === 'plan_adjust' &&
                                                (item as any).status === 'streaming'
                                            );
                                            if (hasPlanAdjust) {
                                                newFeed = handleStep(newFeed, "plan_adjust", "completed", "", true);
                                            }

                                            // Only pause for confirmation if clarification/planning mode is enabled
                                            if (options?.enableClarification) {
                                                newFeed = handleStep(newFeed, "plan_confirm", "streaming", "");
                                                set({ copilotStatus: "awaiting_plan_confirm" });
                                            }

                                            newFeed = handlePlan(newFeed, parsed.userPrompt, parsed.steps, {
                                                refinedIntent: parsed.refinedIntent,
                                                workflowNodes: parsed.workflowNodes,
                                                useCases: parsed.useCases,
                                                howToUse: parsed.howToUse,
                                                verificationQuestions: parsed.verificationQuestions
                                            });
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

            const shouldSkipAutomatedValidation = true;
            if (!shouldSkipAutomatedValidation) {
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

                // CRITICAL FIX: If validation fails, do NOT mark as completed and do NOT update the flow nodes/edges.
                // This prevents "Enter Workflow" button from showing on invalid flows.
                if (!validation.valid) {
                    console.warn("[Agent] Flow validation failed, blocking completion:", validation.errors);
                    set({ copilotStatus: "thinking" }); // Keep thinking status so overlay stays open but button is hidden
                    // Note: We could use a new status 'error' but thinking with error in feed is also clear
                    return;
                }

                // Log validation warnings for debugging
                if (validation.warnings.length > 0) {
                    console.info("[Agent] Flow validation warnings:", validation.warnings);
                }
                // ========== End Auto Validation ==========
            }

            // Reset execution state
            get().resetExecution();

            // Optimize layout first (pure calculation)
            const optimizedNodes = calculateOptimalLayout(nodes, edges);

            // CRITICAL FIX: Batch all state updates into ONE set() call to prevent flicker
            set((state: { copilotFeed: FeedItem[] }) => {
                const hasStreamingResultPrep = state.copilotFeed.some(item =>
                    item.type === "step" &&
                    (item as any).stepType === "result_prep" &&
                    (item as any).status === "streaming"
                );

                return {
                    nodes: optimizedNodes,
                    edges,
                    flowTitle: title,
                    currentFlowId: null,
                    copilotStatus: "completed",
                    copilotFeed: hasStreamingResultPrep
                        ? handleStep(state.copilotFeed, "result_prep", "completed", "", true)
                        : state.copilotFeed
                };
            });

            // Flush save to get flowId immediately
            await get().flushSave();

            // 埋点：Agent 完成
            trackAgentComplete(get().copilotFeed.length, 0);
        } catch (error) {
            // Bug Fix #4 (Enhanced): Do NOT clear copilotFeed to prevent "Blank Canvas" crash.
            // Instead, mark status as completed (to keep overlay open) and add error step.

            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Agent Copilot Error:", error);

            // 自动化网络诊断：如果是网络错误或超时，尝试收集环境信息
            if (errorMessage.includes("fetch") || errorMessage.includes("timeout") || errorMessage.includes("Network")) {
                runQuickDiagnostic().then(metrics => {
                    trackAgentFailNetwork(errorMessage, metrics);
                });
            }

            // Add error step to feed so user sees what happened
            set((state: { copilotFeed: FeedItem[] }) => {
                const hasStreamingResultPrep = state.copilotFeed.some(item =>
                    item.type === "step" &&
                    (item as any).stepType === "result_prep" &&
                    (item as any).status === "streaming"
                );
                const feedAfterPrep = hasStreamingResultPrep
                    ? handleStep(state.copilotFeed, "result_prep", "completed", "", true)
                    : state.copilotFeed;

                return {
                    copilotStatus: "completed", // Keep overlay open so user can see error
                    copilotFeed: handleStep(
                        feedAfterPrep,
                        "error",
                        "error",
                        `❌ 生成过程中发生错误:\n${errorMessage}\n\n请尝试重试或修改提示词。`
                    )
                };
            });
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
            copilotFeed: handleStep(
                handleStep(
                    updatePlanStatus(state.copilotFeed, 'confirmed'),
                    "plan_confirm",
                    "completed",
                    "",
                    true
                ),
                "mapping",
                "streaming",
                "",
                true
            ),
            copilotStatus: 'thinking'
        }));

        // Continue with the original prompt (agent will see plan was confirmed)
        if (currentCopilotPrompt) {
            // Find the confirmed plan to inject as context
            const planItem = copilotFeed.find((f: FeedItem) => f.type === 'plan') as import('@/types/flow').PlanItem | undefined;

            let contextInjection = "";
            if (planItem) {
                const nodesSummary = planItem.workflowNodes?.map(n => `- [${n.type}] ${n.label}: ${n.description}`).join('\n') || planItem.steps.join('\n');

                contextInjection = `
<approved_plan>
## User Intent
${planItem.refinedIntent || "N/A"}

## Approved Workflow Structure
${nodesSummary}

## Use Cases
${planItem.useCases?.join('\n') || "N/A"}
</approved_plan>
`;
            }

            // In a full implementation, we would call the backend to continue generation
            // For now, we restart with a signal that plan is confirmed + context
            const confirmedPrompt = `[PLAN_CONFIRMED]${contextInjection}\n\n${currentCopilotPrompt}`;

            // 埋点：确认计划
            trackCopilotPlanConfirm(planItem ? planItem.steps.length : 0);

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
            copilotFeed: handleStep(
                handleStep(
                    updatePlanStatus(state.copilotFeed, 'adjusting'),
                    "plan_confirm",
                    "completed",
                    "",
                    true
                ),
                "plan_adjust",
                "streaming",
                "",
                true
            ),
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
