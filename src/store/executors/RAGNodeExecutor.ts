import type { AppNode, RAGNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { extractInputFromContext } from "./contextUtils";
import { useFlowStore } from "@/store/flowStore";
import { collectVariablesRaw } from "./utils/variableUtils";

/**
 * 解析变量模板，从全局 flowContext 中提取值
 * 使用公共的 collectVariablesRaw 函数实现全局变量解析
 */
function resolveVariableTemplate(
    template: string,
    context: FlowContext,
    globalVariables: Record<string, unknown>
): unknown {
    // 匹配 {{变量名}} 格式
    const match = template.match(/^\{\{(.+?)\}\}$/);
    if (!match) return template;

    const varPath = match[1].trim();

    // 直接从预收集的全局变量中查找
    if (varPath in globalVariables) {
        return globalVariables[varPath];
    }

    // 支持嵌套路径（如 nodeLabel.files[0].url）
    // 先尝试找到基础变量，再解析嵌套路径
    if (varPath.includes('.')) {
        const parts = varPath.split('.');
        // 尝试不同长度的前缀
        for (let i = parts.length - 1; i >= 1; i--) {
            const baseKey = parts.slice(0, i).join('.');
            if (baseKey in globalVariables) {
                const baseValue = globalVariables[baseKey];
                const remainingPath = parts.slice(i).join('.');
                return getNestedValue(baseValue as Record<string, unknown>, remainingPath);
            }
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
 * 使用服务端 API 进行语义搜索
 * 支持两种模式：
 * 1. 静态文件模式：使用预配置的 FileSearchStore
 * 2. 动态文件模式：从上游引用文件，使用多模态 API 直接处理
 */
export class RAGNodeExecutor extends BaseNodeExecutor {
    async execute(node: AppNode, context: FlowContext, mockData?: Record<string, unknown>): Promise<ExecutionResult> {
        const { result, time } = await this.measureTime(async () => {
            const ragData = node.data as RAGNodeData;

            // 解析 inputMappings
            const inputMappings = (ragData as Record<string, unknown>)?.inputMappings as Record<string, string> | undefined;

            // 1. 解析查询内容（优先使用 mockData）
            let query: string;
            if (mockData && typeof mockData.query === 'string' && mockData.query.trim()) {
                // 调试模式：使用传入的 mock query
                query = mockData.query;
            } else {
                // 正常模式：从 inputMappings 解析
                // 获取全局 flowContext 和所有节点
                const { nodes: allNodes, flowContext: globalFlowContext } = useFlowStore.getState();
                const globalVariables = collectVariablesRaw(context, globalFlowContext, allNodes);
                query = this.resolveQuery(inputMappings?.query, context, globalVariables);
            }

            if (!query || query.trim() === "") {
                return {
                    error: "未找到查询内容。请确保 RAG 节点连接到包含查询内容的上游节点。"
                };
            }

            // 2. 检查是否有动态文件引用
            // 需要重新获取全局变量（如果还没有的话）
            const storeState = useFlowStore.getState();
            const globalVars = collectVariablesRaw(context, storeState.flowContext, storeState.nodes);
            const dynamicFiles = this.resolveDynamicFiles(inputMappings?.files, context, globalVars);

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
    private resolveQuery(
        queryTemplate: string | undefined,
        context: FlowContext,
        globalVariables: Record<string, unknown>
    ): string {
        if (queryTemplate && queryTemplate.trim()) {
            // 解析变量模板
            return queryTemplate.replace(/\{\{([^}]+)\}\}/g, (_match, varPath: string) => {
                const value = resolveVariableTemplate(`{{${varPath}}}`, context, globalVariables);
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
        context: FlowContext,
        globalVariables: Record<string, unknown>
    ): Array<{ name: string; url: string; type?: string }> | null {
        if (!filesTemplate || !filesTemplate.trim()) {
            return null;
        }

        // 解析变量模板获取文件数组（使用全局变量）
        let filesValue = resolveVariableTemplate(filesTemplate, context, globalVariables);

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
     * 使用多模态 API 处理动态文件（通过服务端 API）
     */
    private async executeWithMultimodal(
        query: string,
        files: Array<{ name: string; url: string; type?: string }>
    ): Promise<Record<string, unknown>> {
        try {
            const response = await fetch("/api/rag/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "multimodal",
                    query,
                    files
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API 请求失败: ${response.status}`);
            }

            const searchResult = await response.json();

            return {
                query,
                documents: searchResult.documents,
                citations: searchResult.citations,
                documentCount: searchResult.documents?.length || 0,
                mode: 'multimodal'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            return {
                error: `文件处理失败: ${errorMessage}`
            };
        }
    }

    /**
     * 使用 File Search Store 处理静态文件（通过服务端 API）
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
            const response = await fetch("/api/rag/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "fileSearch",
                    query,
                    fileSearchStoreName: ragData.fileSearchStoreName
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API 请求失败: ${response.status}`);
            }

            const searchResult = await response.json();

            return {
                query,
                documents: searchResult.documents,
                citations: searchResult.citations,
                documentCount: searchResult.documents?.length || 0,
                mode: 'fileSearch'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            return {
                error: `文档搜索失败: ${errorMessage}`
            };
        }
    }
}
