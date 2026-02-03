import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import type { AppNode, FlowContext, ToolNodeData } from "@/types/flow";
import { executeToolAction } from "@/app/actions/tools";
import { TOOL_REGISTRY, type ToolType } from "@/lib/tools/registry";
import { useFlowStore } from "@/store/flowStore";
import { collectVariables } from "./utils/variableUtils";
import { deepReplaceVariablesInUnknown } from "./utils/templateUtils";

/**
 * Type guard for ToolNodeData
 */
function isToolNodeData(data: unknown): data is ToolNodeData {
    return typeof data === 'object' && data !== null && 'toolType' in data;
}

/**
 * Validate tool type is registered
 */
function isValidToolType(toolType: unknown): toolType is ToolType {
    return typeof toolType === 'string' && toolType in TOOL_REGISTRY;
}

export class ToolNodeExecutor extends BaseNodeExecutor {
    async execute(
        node: AppNode,
        context: FlowContext,
        mockData?: Record<string, unknown>
    ): Promise<ExecutionResult> {
        const { result, time } = await this.measureTime(async () => {

            // Use type guards for safer type checking
            if (!isToolNodeData(node.data)) {
                throw new Error("Invalid node data for Tool node");
            }
            const data = node.data;

            if (!isValidToolType(data.toolType)) {
                throw new Error("Tool type is not configured or invalid");
            }
            const toolType = data.toolType;

            // Check for mock data in argument OR in context (passed by executionActions)
            const mockInputs = mockData || (context.mock as Record<string, unknown>);
            let inputs = mockInputs || data.inputs || {};

            // ========== 使用公共函数收集所有上游变量 ==========
            const storeState = useFlowStore.getState();
            const { nodes: allNodes, flowContext: globalFlowContext } = storeState;

            // 使用公共的 collectVariables 函数，确保与其他节点一致的变量解析逻辑
            const allVariables = collectVariables(context, globalFlowContext, allNodes);

            if (Object.keys(allVariables).length > 0) {
                inputs = deepReplaceVariablesInUnknown(inputs, allVariables) as Record<string, unknown>;
            }

            // 参数验证由 executeToolAction (Server Action) 层统一处理
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
