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

    // Input Debug Actions
    openInputDebugDialog: (nodeId: string) => void;
    closeInputDebugDialog: () => void;
    setInputDebugData: (data: { text?: string; files?: File[]; formData?: Record<string, unknown> }) => void;
    confirmInputDebugRun: () => Promise<void>;

    // Output Debug Actions
    openOutputDebugDialog: (nodeId: string) => void;
    closeOutputDebugDialog: () => void;
    setOutputDebugData: (data: { mockVariables?: Record<string, string> }) => void;
    confirmOutputDebugRun: () => Promise<void>;

    // Input Prompt Actions
    openInputPrompt: (nodeId?: string) => void;  // nodeId=undefined 表示所有 Input 节点
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

    // ===== Input Debug Dialog =====
    openInputDebugDialog: (nodeId: string) => {
        set({
            inputDebugNodeId: nodeId,
            inputDebugDialogOpen: true,
            inputDebugData: { text: '', files: [], formData: {} }
        });
    },

    closeInputDebugDialog: () => set({
        inputDebugDialogOpen: false,
        inputDebugData: { text: '', files: [], formData: {} }
    }),

    setInputDebugData: (data) => set({ inputDebugData: data }),

    confirmInputDebugRun: async () => {
        const { inputDebugNodeId, inputDebugData, nodes, updateNodeData, runNode } = get();
        if (!inputDebugNodeId) return;

        try {
            // 更新 Input 节点的数据
            updateNodeData(inputDebugNodeId, {
                text: inputDebugData.text || '',
                // files 需要上传后转换，这里先存储原始 File 对象
                formData: inputDebugData.formData || {},
            });

            set({ inputDebugDialogOpen: false });

            // 运行节点，传入 user_input
            await runNode(inputDebugNodeId, {
                user_input: inputDebugData.text || '',
                formData: inputDebugData.formData || {},
            });
        } catch (e) {
            console.error('[InputDebug] Run failed:', e);
        }
    },

    // ===== Output Debug Dialog =====
    openOutputDebugDialog: (nodeId: string) => {
        set({
            outputDebugNodeId: nodeId,
            outputDebugDialogOpen: true,
            outputDebugData: { mockVariables: {} }
        });
    },

    closeOutputDebugDialog: () => set({
        outputDebugDialogOpen: false,
        outputDebugData: { mockVariables: {} }
    }),

    setOutputDebugData: (data) => set({ outputDebugData: data }),

    confirmOutputDebugRun: async () => {
        const { outputDebugNodeId, outputDebugData, runNode } = get();
        if (!outputDebugNodeId) return;

        try {
            // 使用 mock 变量数据运行 Output 节点
            const mockData = outputDebugData.mockVariables || {};

            set({ outputDebugDialogOpen: false });
            await runNode(outputDebugNodeId, mockData);
        } catch (e) {
            console.error('[OutputDebug] Run failed:', e);
        }
    },

    // ===== Input Prompt Modal =====
    openInputPrompt: (nodeId?: string) => set({
        inputPromptOpen: true,
        inputPromptTargetNodeId: nodeId || null  // null = 显示所有 Input 节点
    }),

    closeInputPrompt: () => set({
        inputPromptOpen: false,
        inputPromptTargetNodeId: null  // 重置
    }),

    confirmInputRun: async () => {
        set({ inputPromptOpen: false });
        // Execute runFlow logic directly (bypass the input check)
        const { runFlow } = get();
        await runFlow();
    },
});
