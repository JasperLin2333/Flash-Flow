import type { NodeKind, AppNodeData } from "@/types/flow";
import { LLM_EXECUTOR_CONFIG } from "@/store/constants/executorConfig";
import { DEFAULT_TOOL_TYPE } from "@/lib/tools/registry";

/**
 * 获取指定节点类型的默认数据
 */
export function getDefaultNodeData(type: NodeKind): Partial<AppNodeData> {
    const defaults: Record<NodeKind, Partial<AppNodeData>> = {
        input: { label: "输入", text: "", status: "idle" },
        llm: {
            label: "LLM",
            model: LLM_EXECUTOR_CONFIG.DEFAULT_MODEL,
            temperature: LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
            systemPrompt: "",
            enableMemory: false,
            memoryMaxTurns: LLM_EXECUTOR_CONFIG.DEFAULT_MEMORY_MAX_TURNS,
            responseFormat: "text",
            inputMappings: { user_input: "{{user_input}}" },
            status: "idle"
        },
        rag: {
            label: "RAG",
            files: [],
            uploadStatus: "idle",
            maxTokensPerChunk: 200,
            maxOverlapTokens: 20,
            status: "idle"
        },
        output: {
            label: "输出",
            status: "idle",
            inputMappings: {
                mode: "select",
                sources: [{ type: "variable", value: "{{response}}" }],
            },
        },
        branch: { label: "分支", condition: "true", status: "idle" },
        tool: { label: "Tool", toolType: DEFAULT_TOOL_TYPE, inputs: {}, status: "idle" },
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
