"use client";
import React from "react";
import type { RAGNodeData } from "@/types/flow";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";

export function RAGMetadata({ rag }: { rag: RAGNodeData }) {
    const files = rag?.files || [];
    const maxTokens = rag?.maxTokensPerChunk || 200;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className={METADATA_LABEL_STYLE}>知识库:</span>
                <span className={METADATA_VALUE_STYLE}>{files.length} 个文件</span>
            </div>
            <div className="flex items-center gap-2">
                <span className={METADATA_LABEL_STYLE}>块大小:</span>
                <span className={METADATA_VALUE_STYLE}>{maxTokens} tokens</span>
            </div>
        </div>
    );
}
