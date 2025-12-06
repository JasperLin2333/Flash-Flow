import type { AppNode, RAGNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { geminiFileSearchAPI } from "@/services/geminiFileSearchAPI";
import { extractInputFromContext } from "./contextUtils";

/**
 * RAG 节点执行器
 * 使用 Gemini File Search API 进行语义搜索
 */
export class RAGNodeExecutor extends BaseNodeExecutor {
  async execute(node: AppNode, context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      const ragData = node.data as RAGNodeData;

      // 检查是否配置了 File Search Store
      if (!ragData.fileSearchStoreName) {
        return {
          error: "RAG 节点未配置 File Search Store。请先上传文件。"
        };
      }

      // FIX: 检查是否有文件上传
      if (!ragData.files || ragData.files.length === 0) {
        return {
          error: "知识库为空，请先上传至少一个文件。"
        };
      }

      // 检查 Gemini API 是否已配置
      if (!geminiFileSearchAPI.isConfigured()) {
        return {
          error: "Gemini API Key 未配置。请在环境变量中设置 NEXT_PUBLIC_GEMINI_API_KEY。"
        };
      }

      // 使用共享工具函数从上游节点提取查询内容
      const query = extractInputFromContext(context, "");

      if (!query || query.trim() === "") {
        return {
          error: "未找到查询内容。请确保 RAG 节点连接到包含查询内容的上游节点。"
        };
      }

      try {
        // 在 File Search Store 中搜索
        const searchResult = await geminiFileSearchAPI.searchInStore(
          query,
          ragData.fileSearchStoreName,
          {
            topK: ragData.topK || 5
          }
        );

        return {
          query,
          documents: searchResult.documents,
          citations: searchResult.citations,
          documentCount: searchResult.documents.length
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[RAGNodeExecutor] Search failed:", errorMessage);

        return {
          error: `文档搜索失败: ${errorMessage}`
        };
      }
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
