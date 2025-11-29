import type { AppNode, LLMNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class LLMNodeExecutor extends BaseNodeExecutor {
  async execute(node: AppNode, context: FlowContext): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(node.type === 'llm' ? 2000 : 1000);
      
      const llmData = node.data as LLMNodeData;
      const inputContent = this.extractInputContent(context);

      try {
        const resp = await fetch("/api/run-node", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: llmData.model || "doubao-seed-1-6-flash-250828",
            systemPrompt: llmData.systemPrompt || "你是AI助手",
            temperature: llmData.temperature ?? 0.7,
            input: inputContent
          }),
        });
        const resData = await resp.json();
        return { response: resData.response || resData.error };
      } catch (e) {
        return { error: String(e) };
      }
    });

    return {
      output: result,
      executionTime: time
    };
  }

  private extractInputContent(context: FlowContext): string {
    // Extract input from upstream nodes
    const upstreamData = Object.values(context)[0];
    if (!upstreamData || typeof upstreamData !== 'object') {
      return "Start";
    }

    const prevObj = upstreamData as Record<string, unknown>;
    return (
      (typeof prevObj.text === 'string' ? prevObj.text : '') ||
      (typeof prevObj.response === 'string' ? prevObj.response : '') ||
      JSON.stringify(upstreamData)
    );
  }
}
