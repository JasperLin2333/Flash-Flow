import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import type { AppNode, FlowContext, ToolNodeData } from "@/types/flow";
import { executeToolAction } from "@/app/actions/tools";
import { validateToolInputs, type ToolType } from "@/lib/tools/registry";

export class ToolNodeExecutor extends BaseNodeExecutor {
    async execute(
        node: AppNode,
        context: FlowContext,
        mockData?: Record<string, unknown>
    ): Promise<ExecutionResult> {
        const data = node.data as ToolNodeData;
        const toolType = data.toolType as ToolType;
        // Check for mock data in argument OR in context (passed by executionActions)
        const mockInputs = mockData || (context.mock as Record<string, unknown>);
        const inputs = mockInputs || data.inputs || {};

        if (!toolType) {
            throw new Error("Tool type is not configured");
        }

        // FIX P3: 在执行前验证参数（调试模式已在 UI 层验证，此处是正式执行的二次验证）
        const validation = validateToolInputs(toolType, inputs);
        if (!validation.success) {
            throw new Error(`参数验证失败: ${validation.error}`);
        }

        const { result, time } = await this.measureTime(async () => {
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
