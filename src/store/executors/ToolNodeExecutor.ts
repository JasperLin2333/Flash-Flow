import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import type { AppNode, FlowContext, ToolNodeData, BaseNodeData } from "@/types/flow";
import { executeToolAction } from "@/app/actions/tools";
import { validateToolInputs, type ToolType } from "@/lib/tools/registry";
import { replaceVariables } from "@/lib/promptParser";
import { useFlowStore } from "@/store/flowStore";

export class ToolNodeExecutor extends BaseNodeExecutor {
    async execute(
        node: AppNode,
        context: FlowContext,
        mockData?: Record<string, unknown>
    ): Promise<ExecutionResult> {
        const { result, time } = await this.measureTime(async () => {

            const data = node.data as ToolNodeData;
            const toolType = data.toolType as ToolType;
            // Check for mock data in argument OR in context (passed by executionActions)
            const mockInputs = mockData || (context.mock as Record<string, unknown>);
            let inputs = mockInputs || data.inputs || {};

            if (!toolType) {
                throw new Error("Tool type is not configured");
            }

            // ========== 收集所有上游变量用于替换 tool inputs ==========
            const storeState = useFlowStore.getState();
            const { nodes: allNodes, flowContext: globalFlowContext } = storeState;

            // 创建节点查找 Map 以优化 O(1) 查找性能
            const nodeMap = new Map(allNodes.map(n => [n.id, n]));

            const allVariables: Record<string, string> = {};

            /**
             * 递归展开对象，将嵌套字段平铺为可引用的变量
             */
            const flattenObject = (obj: unknown, prefix = ""): void => {
                if (obj === null || obj === undefined) return;

                if (typeof obj !== 'object') {
                    if (prefix) {
                        allVariables[prefix] = String(obj);
                    }
                    return;
                }

                const record = obj as Record<string, unknown>;
                for (const [key, value] of Object.entries(record)) {
                    if (key.startsWith('_')) continue;

                    const newKey = prefix ? `${prefix}.${key}` : key;

                    if (value === null || value === undefined) {
                        allVariables[newKey] = "";
                    } else if (typeof value === 'object' && !Array.isArray(value)) {
                        flattenObject(value, newKey);
                    } else if (Array.isArray(value)) {
                        allVariables[newKey] = JSON.stringify(value);
                    } else {
                        allVariables[newKey] = String(value);
                    }
                }
            };

            // 从直接上游 context 中提取变量
            for (const [nodeId, nodeOutput] of Object.entries(context)) {
                if (nodeId.startsWith('_')) continue;

                const nodeRef = nodeMap.get(nodeId);
                const nodeLabel = nodeRef?.data?.label as string | undefined;
                const customOutputs = (nodeRef?.data as BaseNodeData | undefined)?.customOutputs;

                if (typeof nodeOutput === 'object' && nodeOutput !== null) {
                    flattenObject(nodeOutput);
                    if (nodeLabel) {
                        flattenObject(nodeOutput, nodeLabel);
                    }
                    flattenObject(nodeOutput, nodeId);
                }

                // 添加用户自定义的输出变量
                if (customOutputs && customOutputs.length > 0) {
                    customOutputs.forEach(cv => {
                        allVariables[cv.name] = cv.value;
                        if (nodeLabel) {
                            allVariables[`${nodeLabel}.${cv.name}`] = cv.value;
                        }
                        allVariables[`${nodeId}.${cv.name}`] = cv.value;
                    });
                }
            }

            // 从全局 flowContext 中提取变量
            for (const [nodeId, nodeOutput] of Object.entries(globalFlowContext)) {
                if (nodeId.startsWith('_')) continue;
                if (context[nodeId]) continue;

                const nodeRef = nodeMap.get(nodeId);
                const nodeLabel = nodeRef?.data?.label as string | undefined;
                const customOutputs = (nodeRef?.data as BaseNodeData | undefined)?.customOutputs;

                if (typeof nodeOutput === 'object' && nodeOutput !== null) {
                    flattenObject(nodeOutput);
                    if (nodeLabel) {
                        flattenObject(nodeOutput, nodeLabel);
                    }
                    flattenObject(nodeOutput, nodeId);
                }

                // 添加用户自定义的输出变量
                if (customOutputs && customOutputs.length > 0) {
                    customOutputs.forEach(cv => {
                        allVariables[cv.name] = cv.value;
                        if (nodeLabel) {
                            allVariables[`${nodeLabel}.${cv.name}`] = cv.value;
                        }
                        allVariables[`${nodeId}.${cv.name}`] = cv.value;
                    });
                }
            }

            // 替换 inputs 中的变量（只替换字符串类型的值）
            if (Object.keys(allVariables).length > 0) {
                const replacedInputs: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(inputs)) {
                    if (typeof value === 'string') {
                        replacedInputs[key] = replaceVariables(value, allVariables, false);
                    } else {
                        replacedInputs[key] = value;
                    }
                }
                inputs = replacedInputs;
            }

            // FIX P3: 在执行前验证参数（调试模式已在 UI 层验证，此处是正式执行的二次验证）
            const validation = validateToolInputs(toolType, inputs);
            if (!validation.success) {
                throw new Error(`参数验证失败: ${validation.error}`);
            }

            const executionResult = await executeToolAction({
                toolType,
                inputs,
            });

            if (!executionResult.success) {
                throw new Error(executionResult.error || "Tool execution failed");
            }

            return executionResult.data;
        });

        return {
            output: result as Record<string, unknown>,
            executionTime: time,
        };
    }
}
