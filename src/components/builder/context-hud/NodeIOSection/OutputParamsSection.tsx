"use client";
import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ArrowUpFromLine, Copy } from "lucide-react";
import type { OutputField } from "./hooks/useNodeIO";
import { LABEL_CLASS } from "../constants";
import { useToast } from "@/hooks/use-toast";

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
    return (
        <div>
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <ArrowUpFromLine className="w-3 h-3 text-green-600" />
                <span>输出参数</span>
            </h4>
            <div className="space-y-1">
                {/* 系统预定义的输出字段 */}
                {outputFields.map((f, idx) => (
                    <div
                        key={idx}
                        className="flex items-start gap-2 bg-green-50 rounded-lg px-2.5 py-1.5 border border-green-100"
                    >
                        <code className="text-[10px] font-mono text-green-700 shrink-0">
                            {f.field}
                        </code>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-[9px] text-gray-500 truncate cursor-default">
                                    {f.description}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                                {f.description}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                ))}
            </div>
            {nodeLabel && (
                <p className="text-[9px] text-gray-400 mt-2">
                    下游引用格式: <code className="bg-gray-100 px-1 rounded">{`{{${nodeLabel}.字段名}}`}</code>
                </p>
            )}
        </div>
    );
}
