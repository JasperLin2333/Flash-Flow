import type { AppNode, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { getUpstreamData, extractTextFromUpstream } from "./contextUtils";

/**
 * Output 节点执行器
 * 负责从上游节点提取最终输出文本
 */
export class OutputNodeExecutor extends BaseNodeExecutor {
  async execute(_node: AppNode, context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      // 注: 移除了不必要的 500ms 延迟，Output 节点只需透传数据

      // 使用共享工具函数获取上游数据
      const upstreamData = getUpstreamData(context);

      // 使用共享工具函数提取文本
      const text = extractTextFromUpstream(upstreamData, true);

      return { text };
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
