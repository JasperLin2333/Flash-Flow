import { StateCreator } from "zustand";
import type { FlowState, DebugInputs, ImageGenDebugInputs, DialogType, DialogDataMap } from "@/types/flow";

/**
 * ============ 统一弹窗动作接口 (Unified Dialog Actions) ============
 */
export interface UnifiedDialogActions {
    // 统一动作
    openDialog: <T extends DialogType>(type: T, nodeId: string, data?: Partial<DialogDataMap[T]>) => void;
    closeDialog: () => void;
    setDialogData: (data: Record<string, unknown>) => void;
    confirmDialogRun: (extraData?: Record<string, unknown>) => Promise<void>;
}

/**
 * ============ 向后兼容动作接口 (Legacy Actions) ============
 * @deprecated - 使用统一动作代替
 */
export interface LegacyDebugActions {
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
    setOutputDebugData: (data: { mockVariables?: Record<string, any> }) => void;
    confirmOutputDebugRun: () => Promise<void>;

    // Branch Debug Actions
    openBranchDebugDialog: (nodeId: string) => void;
    closeBranchDebugDialog: () => void;
    confirmBranchDebugRun: (mockData: string) => Promise<void>;

    // ImageGen Debug Actions
    openImageGenDebugDialog: (nodeId: string) => void;
    closeImageGenDebugDialog: () => void;
    setImageGenDebugInputs: (inputs: ImageGenDebugInputs) => void;
    confirmImageGenDebugRun: () => Promise<void>;

    // Input Prompt Actions
    openInputPrompt: (nodeId?: string) => void;
    closeInputPrompt: () => void;
    confirmInputRun: () => Promise<void>;
}

export type DebugActions = UnifiedDialogActions & LegacyDebugActions;

// ============ 各类型弹窗的默认数据 ============
const DEFAULT_DIALOG_DATA: Record<DialogType, Record<string, unknown>> = {
    llm: {},
    rag: {},
    tool: {},
    input: { text: '', files: [], formData: {} },
    output: { mockVariables: {} },
    branch: { mockData: '' },
    imagegen: { prompt: '', negativePrompt: '' },
};

export const createDebugActions: StateCreator<
    FlowState,
    [],
    [],
    DebugActions
> = (set, get) => ({
    // ============ 统一弹窗动作实现 ============

    /**
     * 打开指定类型的弹窗
     */
    openDialog: <T extends DialogType>(type: T, nodeId: string, data?: Partial<DialogDataMap[T]>) => {
        const initialData: Record<string, unknown> = { ...DEFAULT_DIALOG_DATA[type], ...data };

        // 特殊处理：ImageGen 需要从节点读取当前数据
        if (type === 'imagegen') {
            const node = get().nodes.find(n => n.id === nodeId);
            if (node) {
                const nodeData = node.data as any;
                initialData.prompt = (data as any)?.prompt ?? nodeData.prompt ?? '';
                initialData.negativePrompt = (data as any)?.negativePrompt ?? nodeData.negativePrompt ?? '';
            }
        }

        // 更新统一状态
        set({
            activeDialog: type,
            activeNodeId: nodeId,
            dialogData: initialData,
        });
    },

    /**
     * 关闭当前弹窗
     */
    closeDialog: () => {
        set({
            activeDialog: null,
            activeNodeId: null,
            dialogData: {},
        });
    },

    /**
     * 更新当前弹窗数据
     */
    setDialogData: (data: Record<string, unknown>) => {
        const { dialogData } = get();
        const newData = { ...dialogData, ...data };

        set({
            dialogData: newData,
        });
    },

    /**
     * 确认运行当前弹窗（通用入口，内部分发到各类型处理逻辑）
     */
    confirmDialogRun: async (extraData?: Record<string, unknown>) => {
        const { activeDialog, activeNodeId, dialogData, runNode, updateNodeData, runFlow, nodes, flowContext } = get();

        // Input dialog accommodates "Run Flow" which implies no specific activeNodeId (or empty string/null) in legacy context
        // But for strict type safety in unified API, we usually expect activeNodeId.
        // We relax the check for 'input' type to allow full flow run (InputPrompt replacement).
        if (!activeDialog || (!activeNodeId && activeDialog !== 'input')) return;

        try {
            // 关闭弹窗
            get().closeDialog();

            // 根据类型分发处理逻辑（保留原有业务逻辑）
            switch (activeDialog) {
                case 'llm':
                case 'rag': {
                    if (!activeNodeId) return;
                    // 转换 DebugInputs 为简单的 key-value 对象
                    const mockData: Record<string, unknown> = {};
                    Object.entries(dialogData as DebugInputs).forEach(([key, debugValue]) => {
                        mockData[key] = debugValue.value;
                    });
                    await runNode(activeNodeId, mockData);
                    break;
                }

                case 'tool': {
                    if (!activeNodeId) return;
                    // toolDebugInputs 已经是简单的 key-value 格式
                    await runNode(activeNodeId, dialogData);
                    break;
                }

                case 'input': {
                    // Logic split:
                    // 1. If activeNodeId is present, it's a Single Node Debug Run.
                    // 2. If activeNodeId is missing, it's a Full Flow Run (InputPrompt).

                    // Note: The UI (InputDebugDialog) updates the node data directly via updateNodeData during interaction (for files/text).
                    // So we don't strictly need to apply dialogData here if the component is syncing real-time.
                    // But for DebugDialog pattern consistency, we might want to ensure it.
                    // However, InputDebugDialog implementation (created previously) DOES update node data directly on change.
                    // So here we essentially just TRIGGER execution.

                    if (activeNodeId) {
                        // Single Node Run - fetch latest data from node store
                        const targetNode = nodes.find(n => n.id === activeNodeId);
                        const nData = targetNode?.data as any; // InputNodeData
                        await runNode(activeNodeId, {
                            user_input: nData?.text || '',
                            formData: nData?.formData || {},
                        });
                    } else {
                        // Full Flow Run
                        await runFlow();
                    }
                    break;
                }

                case 'output': {
                    if (!activeNodeId) return;
                    const outputData = dialogData as { mockVariables?: Record<string, any> };
                    await runNode(activeNodeId, outputData.mockVariables || {});
                    break;
                }

                case 'branch': {
                    if (!activeNodeId) return;
                    // 使用 extraData 中的 mockData（因为 Branch 是通过参数传入的）
                    const mockDataStr = (extraData?.mockData as string) || (dialogData as any).mockData || '';
                    let parsedData: Record<string, unknown> = {};
                    try {
                        parsedData = JSON.parse(mockDataStr);
                    } catch {
                        parsedData = { response: mockDataStr };
                    }

                    // 将 mock 数据注入到 flowContext
                    set({
                        flowContext: {
                            ...flowContext,
                            mock: parsedData,
                        }
                    });
                    await runNode(activeNodeId, parsedData);
                    break;
                }

                case 'imagegen': {
                    if (!activeNodeId) return;
                    const imageGenData = dialogData as Record<string, unknown>;
                    await runNode(activeNodeId, {
                        prompt: imageGenData.prompt ?? '',
                        negativePrompt: imageGenData.negativePrompt ?? '',
                    });
                    break;
                }

                // Removed 'inputPrompt' case
            }
        } catch (e) {
            console.error(`[${activeDialog}Debug] Run failed:`, e);
            throw e;
        }
    },

    // ============ 向后兼容动作（使用统一动作实现） ============

    // LLM
    openLLMDebugDialog: (nodeId: string) => get().openDialog('llm', nodeId),
    closeLLMDebugDialog: () => get().closeDialog(),
    setLLMDebugInputs: (inputs: DebugInputs) => get().setDialogData(inputs),
    confirmLLMDebugRun: () => get().confirmDialogRun(),

    // RAG
    openRAGDebugDialog: (nodeId: string) => get().openDialog('rag', nodeId),
    closeRAGDebugDialog: () => get().closeDialog(),
    setRAGDebugInputs: (inputs: DebugInputs) => get().setDialogData(inputs),
    confirmRAGDebugRun: () => get().confirmDialogRun(),

    // Tool
    openToolDebugDialog: (nodeId: string) => get().openDialog('tool', nodeId),
    closeToolDebugDialog: () => get().closeDialog(),
    setToolDebugInputs: (inputs: Record<string, unknown>) => get().setDialogData(inputs),
    confirmToolDebugRun: () => get().confirmDialogRun(),

    // Input
    openInputDebugDialog: (nodeId: string) => get().openDialog('input', nodeId),
    closeInputDebugDialog: () => get().closeDialog(),
    setInputDebugData: (data) => get().setDialogData(data),
    confirmInputDebugRun: () => get().confirmDialogRun(),

    // Output
    openOutputDebugDialog: (nodeId: string) => get().openDialog('output', nodeId),
    closeOutputDebugDialog: () => get().closeDialog(),
    setOutputDebugData: (data) => get().setDialogData(data),
    confirmOutputDebugRun: () => get().confirmDialogRun(),

    // Branch（特殊：confirmBranchDebugRun 需要传入 mockData 参数）
    openBranchDebugDialog: (nodeId: string) => get().openDialog('branch', nodeId),
    closeBranchDebugDialog: () => get().closeDialog(),
    confirmBranchDebugRun: (mockData: string) => get().confirmDialogRun({ mockData }),

    // ImageGen
    openImageGenDebugDialog: (nodeId: string) => get().openDialog('imagegen', nodeId),
    closeImageGenDebugDialog: () => get().closeDialog(),
    setImageGenDebugInputs: (inputs: ImageGenDebugInputs) => get().setDialogData({ prompt: inputs.prompt, negativePrompt: inputs.negativePrompt }),
    confirmImageGenDebugRun: () => get().confirmDialogRun(),

    // Input Prompt (Mapped to Unified Input Dialog "Run Flow" mode)
    openInputPrompt: (nodeId?: string) => get().openDialog('input', nodeId || ''), // Pass empty string to signify "no specific node" / all nodes if null
    closeInputPrompt: () => get().closeDialog(),
    confirmInputRun: () => get().confirmDialogRun(),
});
