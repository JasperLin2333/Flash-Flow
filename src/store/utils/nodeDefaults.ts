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
        imagegen: {
            label: "图片生成",
            model: "Kwai-Kolors/Kolors",
            prompt: "",
            imageSize: "1024x1024",
            cfg: 7.5,                     // 默认 CFG 值 (基于 Kolors)
            numInferenceSteps: 25,        // 默认推理步数 (基于 Kolors)
            referenceImageMode: "static", // 明确默认参考图模式
            status: "idle"
        },
    };
    return defaults[type] || {};
}
