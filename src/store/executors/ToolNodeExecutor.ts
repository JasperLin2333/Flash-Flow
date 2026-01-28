import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import type { AppNode, FlowContext, ToolNodeData } from "@/types/flow";
import { executeToolAction } from "@/app/actions/tools";
import { TOOL_REGISTRY, type ToolType } from "@/lib/tools/registry";
import { replaceVariables } from "@/lib/promptParser";
import { useFlowStore } from "@/store/flowStore";
import { collectVariables } from "./utils/variableUtils";
import { authService } from "@/services/authService";
import { quotaService } from "@/services/quotaService";

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
    /**
     * Check quota for tool usage
     */
    private async checkQuota(toolType: ToolType): Promise<ExecutionResult | null> {
        try {
            // Check if tool requires points
            const requiredPoints = quotaService.getPointsCost("tool_usage", toolType);
            if (requiredPoints <= 0) return null;

            const user = await authService.getCurrentUser();
            if (!user) {
                return {
                    output: { error: "请先登录以使用工具功能" },
                    executionTime: 0,
                };
            }

            const pointsCheck = await quotaService.checkPoints(user.id, requiredPoints);
            if (!pointsCheck.allowed) {
                return {
                    output: { error: `积分不足，当前余额 ${pointsCheck.balance}，需要 ${pointsCheck.required}。请联系管理员增加积分。` },
                    executionTime: 0,
                };
            }
        } catch (e) {
            return {
                output: { error: "积分检查失败，请稍后重试或联系支持" },
                executionTime: 0,
            };
        }
        return null;
    }

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

            // Check quota before execution
            const quotaError = await this.checkQuota(toolType);
            if (quotaError) {
                // If it's a quota error, we want to return it as the result, not throw
                // But BaseNodeExecutor expects result to be returned or thrown
                // Here we throw to stop execution flow, but we might want to return structured error
                // However, throwing Error with message is standard for now
                throw new Error(quotaError.output.error as string);
            }

            // Check for mock data in argument OR in context (passed by executionActions)
            const mockInputs = mockData || (context.mock as Record<string, unknown>);
            let inputs = mockInputs || data.inputs || {};

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
