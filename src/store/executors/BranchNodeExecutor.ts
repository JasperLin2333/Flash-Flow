import type { AppNode, FlowContext, BranchNodeData } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { getUpstreamData } from "./contextUtils";
import { useFlowStore } from "@/store/flowStore";
import { buildGlobalNodeLookupMap } from "./utils/variableUtils";
import {
    safeEvaluateCondition,
} from "@/lib/branchConditionParser";





/**
 * Branch 节点执行器
 * 
 * 执行逻辑：
 * 1. 获取上游数据
 * 2. 使用安全表达式求值器评估条件
 * 3. 返回 { conditionResult: boolean, ...upstreamData }
 */
export class BranchNodeExecutor extends BaseNodeExecutor {
    async execute(
        node: AppNode,
        context: FlowContext,
        _mockData?: Record<string, unknown>
    ): Promise<ExecutionResult> {
        const { result, time } = await this.measureTime(async () => {
            // 使用共享工具函数获取上游数据
            const upstreamData = getUpstreamData(context);
            const data = node.data as BranchNodeData;
            const condition = data.condition;

            // 如果没有配置条件，默认为 true 以保持连通性
            if (!condition || !condition.trim()) {
                return {
                    passed: true,
                    condition: condition || '',
                    conditionResult: true,
                    ...(typeof upstreamData === 'object' ? upstreamData : { value: upstreamData })
                };
            }

            // 使用公共函数构建全局节点查找 Map（支持引用任意已执行节点）
            const { nodes: allNodes, flowContext: globalFlowContext } = useFlowStore.getState();
            const lookupMap = buildGlobalNodeLookupMap(context, globalFlowContext, allNodes);

            // 使用安全表达式求值器
            const conditionResult = safeEvaluateCondition(condition, context, lookupMap);

            // FIX P2: 透传上游节点的数据时，过滤敏感字段（如 _meta）
            const filteredData = typeof upstreamData === 'object' && upstreamData !== null
                ? Object.fromEntries(
                    Object.entries(upstreamData).filter(([key]) => !key.startsWith('_'))
                )
                : { value: upstreamData };

            // 透传过滤后的上游节点数据，并附加 conditionResult
            return {
                passed: true,
                condition,
                conditionResult,
                ...filteredData
            };
        });

        return {
            output: result as Record<string, unknown>,
            executionTime: time
        };
    }
}
