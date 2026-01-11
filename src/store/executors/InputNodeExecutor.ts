import type { AppNode, InputNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class InputNodeExecutor extends BaseNodeExecutor {
  /**
   * 执行 Input 节点
   * 注: _context 和 _mockData 参数由接口定义要求，但 Input 节点不使用它们
   */
  async execute(node: AppNode, _context: FlowContext, mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      const inputData = node.data as InputNodeData;

      // 1. 优先使用 mockData (调试模式)，否则回退到 node.data (运行时/配置)
      // 这允许我们在不修改节点配置的情况下进行调试 (Stateless Debugging)
      const text = (mockData?.user_input as string) ?? inputData.text ?? "";
      // Bug 7 Fix: 过滤无效文件（确保每个文件都有 URL）
      const rawFiles = (mockData?.files as any[]) ?? inputData.files;
      const files = rawFiles?.filter((f: any) => f && (f.url || f instanceof File)) ?? [];
      const formData = (mockData?.formData as Record<string, unknown>) ?? inputData.formData;

      // Build output object
      const output: Record<string, unknown> = {
        user_input: text,
      };

      // Add file metadata if files are present
      if (files && files.length > 0) {
        output.files = files;
      }

      // Include formData as a nested object
      if (formData && Object.keys(formData).length > 0) {
        output.formData = formData;
      }

      return output;
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
