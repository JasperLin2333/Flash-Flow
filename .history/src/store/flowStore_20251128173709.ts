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

  // ===== Debug Modal =====
  openDebugModal: (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId);
    let initialData = "{}";

    if (node) {
      if (node.type === 'llm') {
        initialData = JSON.stringify({ input: "Sample input for LLM" }, null, 2);
      } else if (node.type === 'rag') {
        initialData = JSON.stringify({ query: "Sample query for RAG" }, null, 2);
      } else if (node.type === 'http') {
        initialData = JSON.stringify({ payload: "Sample HTTP payload" }, null, 2);
      }
    }

    set({
      debugNodeId: nodeId,
      debugModalOpen: true,
      debugMockData: initialData
    });
  },

  closeDebugModal: () => set({ debugModalOpen: false }),

  setDebugMockData: (data: string) => set({ debugMockData: data }),

  confirmDebugRun: async () => {
    const { debugNodeId, debugMockData } = get();
    if (!debugNodeId) return;

    try {
      const mockData = JSON.parse(debugMockData);
      set({ debugModalOpen: false });
      await get().runNode(debugNodeId, mockData);
    } catch (e) {
      console.error("Debug run failed:", e);
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
