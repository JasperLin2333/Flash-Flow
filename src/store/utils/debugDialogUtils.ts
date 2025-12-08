import type { DebugInputs, ToolNodeData, AppNode } from "@/types/flow";
import { TOOL_REGISTRY, type ToolType } from "@/lib/tools/registry";
import { z } from "zod";

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
/**
 * 判断 Tool 节点的参数是否充分配置
 * 
 * 检查所有必填参数是否都已配置：
 * 1. 检查工具类型是否已选择
 * 2. 检查所有必填参数是否都有值
 * 3. 参数值不能为空字符串或纯空格
 * 4. 参数值可以是直接值、变量引用（{{...}}）
 * 
 * @param node Tool 节点
 * @returns 参数是否充分配置
 */
export function isToolNodeParametersConfigured(node: AppNode): boolean {
    const data = node.data as ToolNodeData;
    
    // 检查工具类型是否已选择
    const toolType = data?.toolType as ToolType | undefined;
    if (!toolType) return false;
    
    // 获取工具配置
    const toolConfig = TOOL_REGISTRY[toolType];
    if (!toolConfig || !toolConfig.schema) return false;
    
    // 解析 schema 获取所有字段及其是否为必填
    const shape = (toolConfig.schema as z.ZodObject<any>)._def.shape;
    if (!shape) return true; // 如果无法解析 schema，默认认为配置完整
    
    const configuredInputs = (data?.inputs as Record<string, unknown>) || {};
    
    // 检查所有必填字段
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const zField = fieldSchema as z.ZodTypeAny;
        const isOptional = zField.isOptional();
        
        // 跳过可选字段
        if (isOptional) continue;
        
        // 必填字段必须有值
        const value = configuredInputs[fieldName];
        const valueStr = value !== undefined ? String(value).trim() : '';
        
        // 参数值为空或仅空格，则视为未配置
        if (!valueStr) return false;
    }
    
    return true;
}

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
