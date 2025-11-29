import type { AppNode, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class RAGNodeExecutor extends BaseNodeExecutor {
  async execute(_node: AppNode, _context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(1000);
      return {
        foundDocs: ["Doc 1: Password Reset Guide", "Doc 2: Security Policy"]
      };
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
