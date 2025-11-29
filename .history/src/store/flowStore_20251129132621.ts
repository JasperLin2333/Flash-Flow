"use client";
import { create } from "zustand";
import { flowAPI } from "@/services/flowAPI";
import type { FlowState } from "@/types/flow";

// Import actions
import { createNodeActions } from "./actions/nodeActions";
import { createEdgeActions } from "./actions/edgeActions";
import { createExecutionActions } from "./actions/executionActions";
import { createCopilotActions } from "./actions/copilotActions";

// Import initial state
import { INITIAL_FLOW_STATE } from "./constants/initialState";

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useFlowStore = create<FlowState>((set, get) => ({
  // ===== State =====
  ...INITIAL_FLOW_STATE,

  // ===== Node Actions =====
  ...createNodeActions(set, get),

  // ===== Edge Actions =====
  ...createEdgeActions(set, get),

  // ===== Execution Actions =====
  ...createExecutionActions(set, get),

  // ===== Copilot Actions =====
  ...createCopilotActions(set, get),

  // ===== Simple State Setters =====
  setFlowTitle: (title: string) => {
    set({ flowTitle: title, saveStatus: "saving" });
    get().scheduleSave();
  },

  setFlowIcon: (kind?: "emoji" | "lucide" | "image", name?: string, url?: string) => {
    set({ flowIconKind: kind, flowIconName: name, flowIconUrl: url });
  },

  setCurrentFlowId: (id: string | null) => set({ currentFlowId: id }),

  setInteractionMode: (mode: "select" | "pan") => set({ interactionMode: mode }),

  setAppMode: (isAppMode: boolean) => set({ isAppMode }),

  // ===== Persistence =====
  scheduleSave: async () => {
    if (saveTimer) clearTimeout(saveTimer);

    set({ saveStatus: "saving" });

    saveTimer = setTimeout(async () => {
      try {
        const currentState = get();
        const data = {
          nodes: currentState.nodes,
          edges: currentState.edges
        };
        const title = currentState.flowTitle || "Untitled Flow";

        const id = await flowAPI.autoSave(
          currentState.currentFlowId,
          title,
          data
        );
        set({ currentFlowId: id, saveStatus: "saved" });
      } catch (err) {
        console.error("Auto-save failed:", err);
        set({ saveStatus: "saved" });
      }
    }, 800);
  },

  // ===== LLM Debug Dialog =====
  openLLMDebugDialog: (nodeId: string) => {
    set({
      llmDebugNodeId: nodeId,
      llmDebugDialogOpen: true,
      llmDebugInputs: {}
    });
  },

  closeLLMDebugDialog: () => set({
    llmDebugDialogOpen: false,
    llmDebugInputs: {}
  }),

  setLLMDebugInputs: (inputs) => set({ llmDebugInputs: inputs }),

  confirmLLMDebugRun: async () => {
    const { llmDebugNodeId, llmDebugInputs } = get();
    if (!llmDebugNodeId) return;

    try {
      // 转换 DebugInputs 为简单的 key-value 对象
      const mockData: Record<string, unknown> = {};
      Object.entries(llmDebugInputs).forEach(([key, debugValue]) => {
        mockData[key] = debugValue.value;
      });

      set({ llmDebugDialogOpen: false });
      await get().runNode(llmDebugNodeId, mockData);
    } catch (e) {
      console.error("LLM debug run failed:", e);
    }
  },

  // ===== Input Prompt Modal =====
  openInputPrompt: () => set({ inputPromptOpen: true }),

  closeInputPrompt: () => set({ inputPromptOpen: false }),

  confirmInputRun: async () => {
    set({ inputPromptOpen: false });
    // Execute runFlow logic directly (bypass the input check)
    const { runFlow } = get();
    await runFlow();
  },
}));

// Export constants
export { COPILOT_STEPS } from "./constants/copilotSteps";
