import type { AppNode, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class HTTPNodeExecutor extends BaseNodeExecutor {
  async execute(_node: AppNode, _context: FlowContext): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(1000);
      return {
        status: 200,
        data: { success: true }
      };
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
