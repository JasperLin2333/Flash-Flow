import { normalizePlan, type Plan } from "../utils/planNormalizer";
import { calculateOptimalLayout } from "../utils/layoutAlgorithm";

export const createCopilotActions = (set: any, get: any) => ({
    /**
     * 使用 AI 生成 Flow
     */
    startCopilot: async (prompt: string) => {
        set({ copilotStatus: "thinking", copilotStep: 0 });

        try {
            const ownerId = "anonymous";
            const resp = await fetch("/api/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, ownerId }),
            });
            const plan = await resp.json() as Plan;

            const { nodes, edges } = normalizePlan(plan, prompt);
            const title = plan.title || prompt.slice(0, 30) || "Generated Flow";

            set({ nodes, edges, flowTitle: title });

            // 优化布局
            const optimizedNodes = calculateOptimalLayout(nodes, edges);
            set({ nodes: optimizedNodes });

            await get().scheduleSave();
            set({ copilotStatus: "completed" });
        } catch (error) {
            console.error('Copilot generation failed:', error);
            set({ copilotStatus: "idle" });
        }
    },

    /**
     * 根据prompt生成Flow（简化版，用于示例）
     */
    generateFlowFromPrompt: async (prompt: string) => {
        // 此方法已弃用，使用 startCopilot 代替
        await get().startCopilot(prompt);
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
