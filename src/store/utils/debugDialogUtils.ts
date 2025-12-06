import type { DebugInputs } from "@/types/flow";

/**
 * Debug Dialog 通用状态和动作
 * 用于减少 flowStore 中 LLM/RAG/Tool Debug Dialog 的重复代码
 */

type NodeType = 'llm' | 'rag' | 'tool';

interface DebugDialogState {
    nodeId: string | null;
    dialogOpen: boolean;
    inputs: DebugInputs | Record<string, unknown>;
}

/**
 * 创建 Debug Dialog 的初始状态
 */
export function createDebugDialogInitialState(): DebugDialogState {
    return {
        nodeId: null,
        dialogOpen: false,
        inputs: {},
    };
}

/**
 * 创建 Debug Dialog Actions 的工厂函数
 * 
 * @param nodeType 节点类型标识 (llm, rag, tool)
 * @param set Zustand set 函数
 * @param get Zustand get 函数
 * @param stateKeys 状态字段名映射
 */
export function createDebugDialogActions(
    nodeType: NodeType,
    set: any,
    get: any,
    stateKeys: {
        nodeIdKey: string;
        dialogOpenKey: string;
        inputsKey: string;
    }
) {
    const { nodeIdKey, dialogOpenKey, inputsKey } = stateKeys;

    return {
        /**
         * 打开 Debug Dialog
         */
        open: (nodeId: string) => {
            set({
                [nodeIdKey]: nodeId,
                [dialogOpenKey]: true,
                [inputsKey]: {},
            });
        },

        /**
         * 关闭 Debug Dialog
         */
        close: () => {
            set({
                [dialogOpenKey]: false,
                [inputsKey]: {},
            });
        },

        /**
         * 设置 Debug 输入
         */
        setInputs: (inputs: DebugInputs | Record<string, unknown>) => {
            set({ [inputsKey]: inputs });
        },

        /**
         * 确认运行 Debug
         */
        confirmRun: async () => {
            const state = get();
            const nodeId = state[nodeIdKey];
            if (!nodeId) return;

            try {
                const inputs = state[inputsKey];
                let mockData: Record<string, unknown>;

                // Tool 节点的 inputs 已经是简单的 key-value 格式
                if (nodeType === 'tool') {
                    mockData = inputs as Record<string, unknown>;
                } else {
                    // LLM/RAG 节点需要从 DebugInputs 中提取 value
                    mockData = {};
                    Object.entries(inputs as DebugInputs).forEach(([key, debugValue]) => {
                        mockData[key] = debugValue.value;
                    });
                }

                set({ [dialogOpenKey]: false });
                await get().runNode(nodeId, mockData);
            } catch (e) {
                console.error(`${nodeType.toUpperCase()} debug run failed:`, e);
            }
        },
    };
}
