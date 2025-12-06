import type { NodeKind, AppNodeData } from "@/types/flow";

/**
 * 获取指定节点类型的默认数据
 */
export function getDefaultNodeData(type: NodeKind): Partial<AppNodeData> {
    const defaults: Record<NodeKind, Partial<AppNodeData>> = {
        input: { label: "输入", text: "", status: "idle" },
        llm: { label: "LLM", model: "doubao-seed-1-6-flash-250828", temperature: 0.7, systemPrompt: "", status: "idle" },
        rag: {
            label: "RAG",
            files: [],
            uploadStatus: "idle",
            maxTokensPerChunk: 200,
            maxOverlapTokens: 20,
            topK: 5,
            status: "idle"
        },
        output: { label: "输出", text: "", status: "idle" },
        branch: { label: "分支", status: "idle" },
        tool: { label: "Tool", toolType: "web_search", inputs: {}, status: "idle" },
    };
    return defaults[type] || {};
}
