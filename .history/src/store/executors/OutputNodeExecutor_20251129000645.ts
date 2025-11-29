import type { AppNode, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class OutputNodeExecutor extends BaseNodeExecutor {
  async execute(_node: AppNode, context: FlowContext): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(500);
      
      let text = '';
      const upstreamData = Object.values(context)[0];
      
      if (typeof upstreamData === 'string') {
        text = upstreamData;
      } else if (upstreamData && typeof upstreamData === 'object') {
        const prevObj = upstreamData as Record<string, unknown>;
        const response = prevObj['response'];
        const textField = prevObj['text'];
        const queryField = prevObj['query'];
        
        const maybeText = typeof response === 'string'
          ? response
          : typeof textField === 'string'
            ? textField
            : typeof queryField === 'string'
              ? queryField
              : undefined;
        
        text = typeof maybeText === 'string' ? maybeText : JSON.stringify(prevObj);
      }
      
      return { text };
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
