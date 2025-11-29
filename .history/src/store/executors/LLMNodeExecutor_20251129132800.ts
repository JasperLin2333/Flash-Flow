import type { AppNode, LLMNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";

/**
 * LLM 节点执行器
 * 负责执行 LLM 节点，支持正常模式和调试模式
 */
export class LLMNodeExecutor extends BaseNodeExecutor {
  async execute(
    node: AppNode,
    context: FlowContext,
    mockData?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      await this.delay(node.type === 'llm' ? 2000 : 1000);

      const llmData = node.data as LLMNodeData;
      let systemPrompt = llmData.systemPrompt || "你是AI助手";
      let inputContent: string;

      // 调试模式：使用 mock 数据替换变量
      if (mockData && Object.keys(mockData).length > 0) {
        // 将 mockData 的值转换为字符串
        const stringValues: Record<string, string> = {};
        Object.entries(mockData).forEach(([key, value]) => {
          stringValues[key] = String(value);
        });

        // 替换 systemPrompt 中的变量
        systemPrompt = replaceVariables(systemPrompt, stringValues);

        // 输入内容使用第一个 mock 值或空字符串
        inputContent = Object.values(stringValues)[0] || "";
      } else {
        // 正常模式：从上游节点提取输入
        inputContent = this.extractInputContent(context);
      }

      try {
        const resp = await fetch("/api/run-node", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: llmData.model || "doubao-seed-1-6-flash-250828",
            systemPrompt,
            temperature: llmData.temperature ?? 0.7,
            input: inputContent
          }),
        });

        if (!resp.ok) {
          throw new Error(`API request failed: ${resp.status}`);
        }

        const resData = await resp.json();
        return { response: resData.response || resData.error };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("LLM execution failed:", errorMessage);
        return { error: errorMessage };
      }
    });

    return {
      output: result,
      executionTime: time
    };
  }

  /**
   * 从上游节点提取输入内容
   * 优先级：text > response > JSON
   */
  private extractInputContent(context: FlowContext): string {
    // 获取所有上游节点的数据
    const upstreamValues = Object.values(context);

    if (upstreamValues.length === 0) {
      return "Start";
    }

    // 取第一个上游节点的数据
    const upstreamData = upstreamValues[0];

    if (!upstreamData || typeof upstreamData !== 'object') {
      return "Start";
    }

    const prevObj = upstreamData as Record<string, unknown>;

    // 优先级：text > response > 其他
    if (typeof prevObj.text === 'string' && prevObj.text) {
      return prevObj.text;
    }

    if (typeof prevObj.response === 'string' && prevObj.response) {
      return prevObj.response;
    }

    // 兜底：返回 JSON 字符串
    return JSON.stringify(upstreamData);
  }
}
