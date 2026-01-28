"use client";
import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ArrowUpFromLine } from "lucide-react";
import type { OutputField } from "./hooks/useNodeIO";
import { LABEL_CLASS } from "../constants";

interface OutputParamsSectionProps {
    nodeLabel?: string;
    outputFields: OutputField[];
}

/**
 * 输出参数区块
 * 显示系统预定义输出字段
 */
export function OutputParamsSection({
    nodeLabel,
    outputFields,
}: OutputParamsSectionProps) {
    if (outputFields.length === 0) return null;

    return (
        <div>
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <ArrowUpFromLine className="w-3 h-3 text-green-600" />
                <span>输出参数</span>
            </h4>
            <div className="flex flex-wrap gap-2">
                {/* 系统预定义的输出字段 */}
                {outputFields.map((f, idx) => (
                    <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                            <div
                                className="inline-flex items-center gap-1.5 bg-green-50 rounded-full px-2.5 py-1 border border-green-200 cursor-default transition-colors hover:bg-green-100"
                            >
                                <code className="text-[10px] font-mono text-green-700 font-semibold">
                                    {f.field}
                                </code>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                            {f.description}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
            {nodeLabel && (
                <p className="text-[9px] text-gray-400 mt-2 ml-1">
                    下游引用格式: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600 font-mono">{`{{${nodeLabel}.字段名}}`}</code>
                </p>
            )}
        </div>
    );
}
