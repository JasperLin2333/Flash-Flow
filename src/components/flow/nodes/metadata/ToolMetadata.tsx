"use client";
import React from "react";
import { type ToolType, TOOL_REGISTRY } from "@/lib/tools/registry";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";

export function ToolMetadata({ tool }: { tool: import("@/types/flow").ToolNodeData }) {
    const toolType = tool?.toolType as ToolType | undefined;

    if (!toolType) return null;

    // 使用 TOOL_REGISTRY 获取工具配置（统一数据源）
    const toolConfig = TOOL_REGISTRY[toolType];
    const toolName = toolConfig?.name || toolType;

    return (
        <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>执行能力</span>
            <span className={METADATA_VALUE_STYLE}>{toolName}</span>
        </div>
    );
}
