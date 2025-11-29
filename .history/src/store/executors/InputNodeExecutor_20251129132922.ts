import type { AppNode, InputNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class InputNodeExecutor extends BaseNodeExecutor {
  async execute(_node: AppNode, _context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(500);
      const inputData = _node.data as InputNodeData;
      return {
        query: inputData.text || "默认查询",
        timestamp: new Date().toISOString()
      };
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
