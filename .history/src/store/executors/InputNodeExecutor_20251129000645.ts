import type { AppNode, InputNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class InputNodeExecutor extends BaseNodeExecutor {
  async execute(node: AppNode, _context: FlowContext): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(500);
      const inputData = node.data as InputNodeData;
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
