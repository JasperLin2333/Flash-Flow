"use client";
import React from "react";
import type { RAGNodeData } from "@/types/flow";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";

export function RAGMetadata({ rag }: { rag: RAGNodeData }) {
    const maxTokens = rag?.maxTokensPerChunk || 200;

    // 根据模式显示不同信息
    const getFileInfo = () => {
        const hasVariableInput = !!rag?.inputMappings?.files || !!rag?.inputMappings?.files2 || !!rag?.inputMappings?.files3;
        const effectiveFileMode = rag?.fileMode || (hasVariableInput ? 'variable' : 'static');
        if (effectiveFileMode === 'variable') {
            // 变量模式：显示配置的变量引用数量
            const variableCount = [
                rag.inputMappings?.files,
                rag.inputMappings?.files2,
                rag.inputMappings?.files3
            ].filter(Boolean).length;
            return `${variableCount} 个变量引用`;
        }
        // 静态模式：显示所有槽位的文件数量
        const totalFiles = (rag?.files?.length || 0) +
            (rag?.files2?.length || 0) +
            (rag?.files3?.length || 0);
        return `${totalFiles} 个文件`;
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className={METADATA_LABEL_STYLE}>知识来源</span>
                <span className={METADATA_VALUE_STYLE}>{getFileInfo()}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className={METADATA_LABEL_STYLE}>分块大小</span>
                <span className={METADATA_VALUE_STYLE}>{maxTokens} tokens</span>
            </div>
        </div>
    );
}
