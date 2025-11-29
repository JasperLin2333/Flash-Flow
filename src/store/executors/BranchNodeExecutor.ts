import type { AppNode, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class BranchNodeExecutor extends BaseNodeExecutor {
  async execute(_node: AppNode, _context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(500);
      return {
        condition: true,
        branch: "main"
      };
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
