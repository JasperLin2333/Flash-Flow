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

  // ===== Layout Actions =====
  organizeNodes: () => {
    const { nodes, edges } = get();
    // Dynamically import the layout algorithm to avoid issues
    import("./utils/layoutAlgorithm").then(({ calculateOptimalLayout }) => {
      const updatedNodes = calculateOptimalLayout(nodes, edges);
      set({ nodes: updatedNodes, saveStatus: "saving" });
      get().scheduleSave();
    });
  },

  // ===== Persistence =====
  /**
   * CRITICAL FIX: Schedule a debounced save operation
   * 
   * TIMING: Returns a Promise that resolves when save completes (after 800ms debounce)
   * This allows callers to await the completion and get the flowId
   * 
   * RACE CONDITION FIX: Previously this was async () => void, causing race conditions
   * where dependent code tried to read currentFlowId before save completed.
   * 
   * @returns Promise<string | null> - The saved flow ID, or null if save failed
   */
  scheduleSave: (): Promise<string | null> => {
    // Clear any pending save timer
    if (saveTimer) clearTimeout(saveTimer);

    set({ saveStatus: "saving" });

    // ASYNC CHAIN: Return a promise that resolves after debounce + save
    return new Promise((resolve) => {
      saveTimer = setTimeout(async () => {
        try {
          const currentState = get();
          const data = {
            nodes: currentState.nodes,
            edges: currentState.edges
          };
          const title = currentState.flowTitle || "Untitled Flow";

          // WHY: autoSave returns the flowId (either existing or newly created)
          const id = await flowAPI.autoSave(
            currentState.currentFlowId,
            title,
            data
          );

          set({ currentFlowId: id, saveStatus: "saved" });
          resolve(id);
        } catch (err) {
          console.error("Auto-save failed:", err);
          set({ saveStatus: "saved" }); // Reset status even on error
          resolve(null); // FIX: Resolve with null instead of rejecting, don't break the flow
        }
      }, 800);
    });
  },

  /**
   * CRITICAL FIX: Immediately save without debounce
   * 
   * WHY: For critical operations like copilot completion, we need the flowId immediately
   * to update the URL. Can't wait for the 800ms debounce.
   * 
   * USE CASE: After generating a flow, we need the ID right away to update URL
   * 
   * @returns Promise<string | null> - The saved flow ID, or null if save failed
   */
  flushSave: async (): Promise<string | null> => {
    // TIMING: Cancel any pending debounced save
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    set({ saveStatus: "saving" });

    try {
      const currentState = get();
      const data = {
        nodes: currentState.nodes,
        edges: currentState.edges
      };
      const title = currentState.flowTitle || "Untitled Flow";

      // WHY: Immediate save, no debounce
      const id = await flowAPI.autoSave(
        currentState.currentFlowId,
        title,
        data
      );

      set({ currentFlowId: id, saveStatus: "saved" });
      return id;
    } catch (err) {
      console.error("Flush save failed:", err);
      set({ saveStatus: "saved" });
      return null;
    }
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

  // ===== RAG Debug Dialog =====
  openRAGDebugDialog: (nodeId: string) => {
    set({
      ragDebugNodeId: nodeId,
      ragDebugDialogOpen: true,
      ragDebugInputs: {}
    });
  },

  closeRAGDebugDialog: () => set({
    ragDebugDialogOpen: false,
    ragDebugInputs: {}
  }),

  setRAGDebugInputs: (inputs) => set({ ragDebugInputs: inputs }),

  confirmRAGDebugRun: async () => {
    const { ragDebugNodeId, ragDebugInputs } = get();
    if (!ragDebugNodeId) return;

    try {
      const mockData: Record<string, unknown> = {};
      Object.entries(ragDebugInputs).forEach(([key, debugValue]) => {
        mockData[key] = debugValue.value;
      });

      set({ ragDebugDialogOpen: false });
      await get().runNode(ragDebugNodeId, mockData);
    } catch (e) {
      console.error("RAG debug run failed:", e);
    }
  },

  // ===== Tool Debug Dialog =====
  openToolDebugDialog: (nodeId: string) => {
    set({
      toolDebugNodeId: nodeId,
      toolDebugDialogOpen: true,
      toolDebugInputs: {}
    });
  },

  closeToolDebugDialog: () => set({
    toolDebugDialogOpen: false,
    toolDebugInputs: {}
  }),

  setToolDebugInputs: (inputs) => set({ toolDebugInputs: inputs }),

  confirmToolDebugRun: async () => {
    const { toolDebugNodeId, toolDebugInputs } = get();
    if (!toolDebugNodeId) return;

    try {
      // toolDebugInputs 现在已经是简单的 key-value 格式，直接传递
      const mockData: Record<string, unknown> = toolDebugInputs;

      set({ toolDebugDialogOpen: false });
      await get().runNode(toolDebugNodeId, mockData);
    } catch (e) {
      console.error("Tool debug run failed:", e);
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

  // ===== Streaming Actions =====
  setStreamingText: (text: string) => set({ streamingText: text, isStreaming: true }),

  appendStreamingText: (chunk: string) => set((state: FlowState) => {
    // 如果 streaming 已被主动中断（用户点击了"新建对话"），则忽略后续的流式内容
    if ((state as any)._streamingAborted) {
      return state; // 不做任何改变
    }
    return {
      streamingText: state.streamingText + chunk,
      isStreaming: true,
    };
  }),

  // 正常清理 streaming（开始新的 streaming 前调用）
  clearStreaming: () => set({ streamingText: "", isStreaming: false }),

  // 主动中断 streaming（用户点击新建对话时调用）
  abortStreaming: () => set({ streamingText: "", isStreaming: false, _streamingAborted: true } as any),

  // 重置中断标志（开始新的 streaming 前调用）
  resetStreamingAbort: () => set({ _streamingAborted: false } as any),
}));

// Export constants
export { COPILOT_STEPS } from "./constants/copilotSteps";
