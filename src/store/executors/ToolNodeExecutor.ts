import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import type { AppNode, FlowContext, ToolNodeData } from "@/types/flow";
import { executeToolAction } from "@/app/actions/tools";
import { validateToolInputs, type ToolType } from "@/lib/tools/registry";
import { replaceVariables } from "@/lib/promptParser";
import { useFlowStore } from "@/store/flowStore";
import { collectVariables } from "./utils/variableUtils";

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

            // ========== 使用公共函数收集所有上游变量 ==========
            const storeState = useFlowStore.getState();
            const { nodes: allNodes, flowContext: globalFlowContext } = storeState;

            // 使用公共的 collectVariables 函数，确保与其他节点一致的变量解析逻辑
            const allVariables = collectVariables(context, globalFlowContext, allNodes);

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
