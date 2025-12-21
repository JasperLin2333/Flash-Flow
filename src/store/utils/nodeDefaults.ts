import type { NodeKind, AppNodeData } from "@/types/flow";
import { LLM_EXECUTOR_CONFIG } from "@/store/constants/executorConfig";

/**
 * 获取指定节点类型的默认数据
 */
export function getDefaultNodeData(type: NodeKind): Partial<AppNodeData> {
    const defaults: Record<NodeKind, Partial<AppNodeData>> = {
        input: { label: "输入", text: "", status: "idle" },
        llm: { label: "LLM", model: LLM_EXECUTOR_CONFIG.DEFAULT_MODEL, temperature: LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE, systemPrompt: "", status: "idle" },
        rag: {
            label: "RAG",
            files: [],
            uploadStatus: "idle",
            maxTokensPerChunk: 200,
            maxOverlapTokens: 20,
            status: "idle"
        },
        output: { label: "输出", text: "", status: "idle" },
        branch: { label: "分支", status: "idle" },
        tool: { label: "Tool", toolType: "web_search", inputs: {}, status: "idle" },
    };
    return defaults[type] || {};
}
