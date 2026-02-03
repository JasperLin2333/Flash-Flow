"use client";
import React from "react";
import type { LLMNodeData } from "@/types/flow";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";
import { llmModelsAPI } from "@/services/llmModelsAPI";

export function LLMMetadata({ llm }: { llm: LLMNodeData }) {
    const [modelName, setModelName] = React.useState<string>("");

    React.useEffect(() => {
        const modelId = llm?.model;
        if (!modelId) return;

        let isMounted = true;

        const loadModelName = async () => {
            // 1. Try to get from individual lookup (uses cache internally)
            const model = await llmModelsAPI.getModelByModelId(modelId);

            if (isMounted) {
                if (model) {
                    setModelName(model.model_name);
                } else {
                    // Fallback to simple formatting if not found
                    const displayName = modelId.includes('/')
                        ? modelId.split('/').pop() || modelId
                        : modelId;
                    setModelName(displayName);
                }
            }
        };

        // Reset name immediately when ID changes (optional, but good for UI responsiveness)
        setModelName("");
        loadModelName();

        return () => {
            isMounted = false;
        };
    }, [llm?.model]);

    const hasConfig = llm?.model;
    if (!hasConfig) return null;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className={METADATA_LABEL_STYLE}>核心模型</span>
                <span className={METADATA_VALUE_STYLE}>{modelName || "加载中…"}</span>
            </div>
            {typeof llm.temperature === "number" && (
                <div className="flex items-center gap-2">
                    <span className={METADATA_LABEL_STYLE}>创意度</span>
                    <span className={METADATA_VALUE_STYLE}>{llm.temperature}</span>
                </div>
            )}
            {llm.enableMemory && (
                <div className="flex items-center gap-2">
                    <span className={METADATA_LABEL_STYLE}>对话记忆</span>
                    <span className={METADATA_VALUE_STYLE}>开启 ({llm.memoryMaxTurns || 10}轮)</span>
                </div>
            )}
        </div>
    );
}
