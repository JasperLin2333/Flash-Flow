import type { AppNode, InputNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";

export class InputNodeExecutor extends BaseNodeExecutor {
  /**
   * 执行 Input 节点
   * 注: _context 和 _mockData 参数由接口定义要求，但 Input 节点不使用它们
   */
  async execute(node: AppNode, _context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      // 注: 移除了不必要的 500ms 延迟，Input 节点只需提取数据
      const inputData = node.data as InputNodeData;

      // Build output object
      const output: Record<string, unknown> = {
        // Always include user_input (main text)
        user_input: inputData.text || "",
      };

      // Add file metadata if files are present
      if (inputData.files && inputData.files.length > 0) {
        output.files = inputData.files;
      }

      // Include formData as a nested object (fields accessible via formData.fieldName)
      // 注意：不再过滤 field_ 前缀，因为默认创建的表单字段使用此前缀
      if (inputData.formData && Object.keys(inputData.formData).length > 0) {
        output.formData = inputData.formData;
      }

      return output;
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
