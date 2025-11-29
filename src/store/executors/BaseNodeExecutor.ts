import type { AppNode, FlowContext } from "@/types/flow";

export interface ExecutionResult {
  output: Record<string, unknown>;
  executionTime: number;
}

export interface NodeExecutor {
  execute(node: AppNode, context: FlowContext, mockData?: Record<string, unknown>): Promise<ExecutionResult>;
}

export abstract class BaseNodeExecutor implements NodeExecutor {
  abstract execute(node: AppNode, context: FlowContext, mockData?: Record<string, unknown>): Promise<ExecutionResult>;

  protected async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now();
    const result = await fn();
    const time = Date.now() - start;
    return { result, time };
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
