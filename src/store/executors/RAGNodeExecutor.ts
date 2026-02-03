import type { AppNode, RAGNodeData, FlowContext } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { extractInputFromContext } from "./contextUtils";
import { useFlowStore } from "@/store/flowStore";
import { collectVariablesRaw, resolveVariableTemplate } from "./utils/variableUtils";
import { quotaService } from "@/services/quotaService";
import { authService } from "@/services/authService";
import { useQuotaStore } from "@/store/quotaStore";

/**
 * RAG 节点执行器
 * 使用服务端 API 进行语义搜索
 * 支持两种模式：
 * 1. 静态文件模式：使用预配置的 FileSearchStore
 * 2. 动态文件模式：从上游引用文件，使用多模态 API 直接处理
 */
export class RAGNodeExecutor extends BaseNodeExecutor {
    async execute(node: AppNode, context: FlowContext, mockData?: Record<string, unknown>): Promise<ExecutionResult> {
        // Quota check - RAG uses LLM quota (llm_executions)
        const quotaError = await this.checkQuota();
        if (quotaError) {
            return quotaError;
        }

        const { result, time } = await this.measureTime(async () => {
            const ragData = node.data as RAGNodeData;

            // 统一获取 store 状态（避免重复调用）
            const { nodes, flowContext: globalFlowContext } = useFlowStore.getState();
            const globalVariables = collectVariablesRaw(context, globalFlowContext, nodes);

            // 解析 inputMappings（使用类型安全的访问）
            const inputMappings = ragData.inputMappings;

            // 1. 解析查询内容（优先使用 mockData）
            let query: string;
            if (mockData && typeof mockData.query === 'string' && mockData.query.trim()) {
                // 调试模式：使用传入的 mock query
                query = mockData.query;
            } else {
                // 正常模式：从 inputMappings 解析
                query = this.resolveQuery(inputMappings?.query, context, globalVariables);
            }

            if (!query || query.trim() === "") {
                return {
                    error: "未找到查询内容。请确保 RAG 节点连接到包含查询内容的上游节点。"
                };
            }

            // 2. 检查动态文件引用（支持最多3个来源）
            let allDynamicFiles: Array<{ name: string; url: string; type?: string }> = [];

            // 遍历 files, files2, files3
            const fileKeys = ['files', 'files2', 'files3'] as const;
            for (const key of fileKeys) {
                const template = inputMappings?.[key];
                if (template) {
                    const files = this.resolveDynamicFiles(template, context, globalVariables);
                    if (files) {
                        allDynamicFiles.push(...files);
                    }
                }
            }

            // 模式处理策略
            const fileMode = ragData.fileMode; // 'variable' | 'static' | undefined

            let response: Record<string, unknown>;

            // 策略 1: 明确指定为 "变量模式"
            if (fileMode === 'variable') {
                if (allDynamicFiles.length > 0) {
                    response = await this.executeWithMultimodal(query, allDynamicFiles);
                } else {
                    return { error: "当前为变量模式，但未检测到有效的文件输入。请检查 inputMappings 配置。" };
                }
            }
            // 策略 2: 明确指定为 "静态模式"
            else if (fileMode === 'static') {
                response = await this.executeWithFileSearch(query, ragData);
            }
            // 策略 3: Legacy/未定义 (自动回退逻辑 - 保持向后兼容)
            else {
                if (allDynamicFiles.length > 0) {
                    response = await this.executeWithMultimodal(query, allDynamicFiles);
                } else {
                    response = await this.executeWithFileSearch(query, ragData);
                }
            }

            // 成功时刷新配额 UI
            if (!response.error) {
                this.refreshQuota();
            }

            return response;
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
        const payload = {
            mode: "multimodal",
            query,
            files
        };

        return this.callSearchApi(payload, query, 'multimodal');
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

        // 检查是否有文件上传（检查所有槽位）
        const allStaticFiles = [
            ...(ragData.files || []),
            ...(ragData.files2 || []),
            ...(ragData.files3 || [])
        ];
        if (allStaticFiles.length === 0) {
            return {
                error: "知识库为空，请先上传至少一个文件。"
            };
        }

        const payload = {
            mode: "fileSearch",
            query,
            fileSearchStoreName: ragData.fileSearchStoreName
        };

        return this.callSearchApi(payload, query, 'fileSearch');
    }

    /**
     * 统一的搜索 API 调用方法 (带超时保护)
     */
    private async callSearchApi(
        payload: Record<string, unknown>,
        query: string,
        mode: string
    ): Promise<Record<string, unknown>> {
        const controller = new AbortController();
        // 设置 60 秒超时，防止请求长期挂起
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch("/api/rag/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API 请求失败: ${response.status}`);
            }

            const searchResult = await response.json();
            const normalizedDocuments = Array.isArray(searchResult?.documents)
                ? searchResult.documents.map(String)
                : typeof searchResult?.documents === "string"
                    ? [searchResult.documents]
                    : typeof searchResult?.text === "string" && searchResult.text.trim()
                        ? [searchResult.text]
                        : [];

            return {
                query,
                documents: normalizedDocuments,
                citations: searchResult.citations,
                documentCount: normalizedDocuments.length,
                mode
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // 区分超时错误
            if (error instanceof DOMException && error.name === 'AbortError') {
                return { error: `搜索请求超时 (60s)，请稍后重试。` };
            }
            return {
                error: `检索失败: ${errorMessage}`
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * 检查配额（使用 LLM 配额）
     */
    private async checkQuota(): Promise<ExecutionResult | null> {
        try {
            const user = await authService.getCurrentUser();
            if (!user) {
                return {
                    output: { error: "请先登录以使用 RAG 功能" },
                    executionTime: 0,
                };
            }

            const requiredPoints = quotaService.getPointsCost("rag_search");
            const pointsCheck = await quotaService.checkPoints(user.id, requiredPoints);
            if (!pointsCheck.allowed) {
                return {
                    output: { error: `积分不足，当前余额 ${pointsCheck.balance}，需要 ${pointsCheck.required}。请联系管理员增加积分。` },
                    executionTime: 0,
                };
            }
        } catch {
            return {
                output: { error: "积分检查失败，请稍后重试或联系支持" },
                executionTime: 0,
            };
        }
        return null;
    }

    /**
     * 刷新配额 UI（服务端已扣减）
     */
    private async refreshQuota() {
        try {
            const user = await authService.getCurrentUser();
            if (user) {
                const { refreshQuota } = useQuotaStore.getState();
                await refreshQuota(user.id);
            }
        } catch {
            // Quota UI refresh failed - non-critical
        }
    }
}
