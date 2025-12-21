import { StateCreator } from "zustand";
import type { FlowState, DebugInputs } from "@/types/flow";

export interface DebugActions {
    // LLM Debug Actions
    openLLMDebugDialog: (nodeId: string) => void;
    closeLLMDebugDialog: () => void;
    setLLMDebugInputs: (inputs: DebugInputs) => void;
    confirmLLMDebugRun: () => Promise<void>;

    // RAG Debug Actions
    openRAGDebugDialog: (nodeId: string) => void;
    closeRAGDebugDialog: () => void;
    setRAGDebugInputs: (inputs: DebugInputs) => void;
    confirmRAGDebugRun: () => Promise<void>;

    // Tool Debug Actions
    openToolDebugDialog: (nodeId: string) => void;
    closeToolDebugDialog: () => void;
    setToolDebugInputs: (inputs: Record<string, unknown>) => void;
    confirmToolDebugRun: () => Promise<void>;

    // Input Prompt Actions
    openInputPrompt: () => void;
    closeInputPrompt: () => void;
    confirmInputRun: () => Promise<void>;
}

export const createDebugActions: StateCreator<
    FlowState,
    [],
    [],
    DebugActions
> = (set, get) => ({
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
            // Silently handled
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
            // Silently handled
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
            // Silently handled
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
});
