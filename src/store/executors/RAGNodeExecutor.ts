import type { AppNode, RAGNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { geminiFileSearchAPI } from "@/services/geminiFileSearchAPI";
import { extractInputFromContext } from "./contextUtils";

/**
 * 解析变量模板，从 context 中提取值
 */
function resolveVariableTemplate(
  template: string,
  context: FlowContext
): unknown {
  // 匹配 {{变量名}} 格式
  const match = template.match(/^\{\{(.+?)\}\}$/);
  if (!match) return template;

  const varPath = match[1].trim();

  // 尝试 nodeLabel.field 格式（支持多级路径如 nodeLabel.files[0].url）
  if (varPath.includes('.')) {
    const parts = varPath.split('.');
    const [nodeRef, ...fieldParts] = parts;

    // 先按节点 ID 查找
    if (context[nodeRef]) {
      return getNestedValue(context[nodeRef] as Record<string, unknown>, fieldParts.join('.'));
    }

    // 再按节点标签查找
    const meta = context._meta as { nodeLabels?: Record<string, string> } | undefined;
    if (meta?.nodeLabels) {
      const nodeId = Object.entries(meta.nodeLabels).find(([, label]) => label === nodeRef)?.[0];
      if (nodeId && context[nodeId]) {
        return getNestedValue(context[nodeId] as Record<string, unknown>, fieldParts.join('.'));
      }
    }
  }

  // 尝试直接字段名匹配
  for (const [key, value] of Object.entries(context)) {
    if (key.startsWith('_')) continue;
    const nodeOutput = value as Record<string, unknown>;
    if (varPath in nodeOutput) {
      return nodeOutput[varPath];
    }
  }

  return undefined;
}

/**
 * 从嵌套对象中获取值，支持 field.subfield 和 array[index] 语法
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(/\.|\[/).map(p => p.replace(/\]$/, ''));
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * RAG 节点执行器
 * 使用 Gemini File Search API 进行语义搜索
 * 支持两种模式：
 * 1. 静态文件模式：使用预配置的 FileSearchStore
 * 2. 动态文件模式：从上游引用文件，使用多模态 API 直接处理
 */
export class RAGNodeExecutor extends BaseNodeExecutor {
  async execute(node: AppNode, context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      const ragData = node.data as RAGNodeData;

      // 检查 Gemini API 是否已配置
      if (!geminiFileSearchAPI.isConfigured()) {
        return {
          error: "Gemini API Key 未配置。请在环境变量中设置 NEXT_PUBLIC_GEMINI_API_KEY。"
        };
      }

      // 解析 inputMappings
      const inputMappings = (ragData as Record<string, unknown>)?.inputMappings as Record<string, string> | undefined;

      // 1. 解析查询内容
      const query = this.resolveQuery(inputMappings?.query, context);
      if (!query || query.trim() === "") {
        return {
          error: "未找到查询内容。请确保 RAG 节点连接到包含查询内容的上游节点。"
        };
      }

      // 2. 检查是否有动态文件引用
      const dynamicFiles = this.resolveDynamicFiles(inputMappings?.files, context);

      if (dynamicFiles && dynamicFiles.length > 0) {
        // 使用多模态 API 处理动态文件
        return await this.executeWithMultimodal(query, dynamicFiles);
      } else {
        // 使用 File Search Store 处理静态文件
        return await this.executeWithFileSearch(query, ragData);
      }
    });

    return {
      output: result,
      executionTime: time
    };
  }

  /**
   * 解析查询内容
   */
  private resolveQuery(queryTemplate: string | undefined, context: FlowContext): string {
    if (queryTemplate && queryTemplate.trim()) {
      // 解析变量模板
      return queryTemplate.replace(/\{\{([^}]+)\}\}/g, (_match, varPath: string) => {
        const value = resolveVariableTemplate(`{{${varPath}}}`, context);
        return String(value ?? '');
      });
    }
    // 降级到自动提取
    return extractInputFromContext(context, "");
  }

  /**
   * 从 inputMappings.files 解析动态文件
   */
  private resolveDynamicFiles(
    filesTemplate: string | undefined,
    context: FlowContext
  ): Array<{ name: string; url: string; type?: string }> | null {
    if (!filesTemplate || !filesTemplate.trim()) {
      return null;
    }

    // 解析变量模板获取文件数组
    let filesValue = resolveVariableTemplate(filesTemplate, context);

    if (!filesValue) {
      return null;
    }

    // Support single file object (wrap in array)
    if (!Array.isArray(filesValue) && typeof filesValue === 'object') {
      filesValue = [filesValue];
    }

    if (!Array.isArray(filesValue)) {
      return null;
    }

    // 过滤出有 URL 的文件
    const validFiles = filesValue
      .filter((f: unknown) => {
        if (typeof f !== 'object' || f === null) return false;
        const file = f as Record<string, unknown>;
        return typeof file.url === 'string' && file.url.trim() !== '';
      })
      .map((f: unknown) => {
        const file = f as Record<string, unknown>;
        return {
          name: String(file.name || 'unknown'),
          url: String(file.url),
          type: file.type ? String(file.type) : undefined
        };
      });

    return validFiles.length > 0 ? validFiles : null;
  }

  /**
   * 使用多模态 API 处理动态文件
   */
  private async executeWithMultimodal(
    query: string,
    files: Array<{ name: string; url: string; type?: string }>
  ): Promise<Record<string, unknown>> {
    try {

      const searchResult = await geminiFileSearchAPI.queryWithFiles(query, files);

      return {
        query,
        documents: searchResult.documents,
        citations: searchResult.citations,
        documentCount: searchResult.documents.length,
        mode: 'multimodal'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[RAGNodeExecutor] Multimodal query failed:", errorMessage);

      return {
        error: `文件处理失败: ${errorMessage}`
      };
    }
  }

  /**
   * 使用 File Search Store 处理静态文件
   */
  private async executeWithFileSearch(
    query: string,
    ragData: RAGNodeData
  ): Promise<Record<string, unknown>> {
    // 检查是否配置了 File Search Store
    if (!ragData.fileSearchStoreName) {
      return {
        error: "RAG 节点未配置知识库。请在 Builder 中上传文件，或配置 inputMappings.files 引用上游文件。"
      };
    }

    // 检查是否有文件上传
    if (!ragData.files || ragData.files.length === 0) {
      return {
        error: "知识库为空，请先上传至少一个文件。"
      };
    }

    try {

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
        documentCount: searchResult.documents.length,
        mode: 'fileSearch'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[RAGNodeExecutor] Search failed:", errorMessage);

      return {
        error: `文档搜索失败: ${errorMessage}`
      };
    }
  }
}
