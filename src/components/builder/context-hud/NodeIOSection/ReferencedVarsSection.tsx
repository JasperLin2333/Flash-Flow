"use client";
import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CheckCircle2, Link, AlertCircle } from "lucide-react";
import type { ReferencedVariable } from "../types";
import { LABEL_CLASS } from "../constants";

interface ReferencedVarsSectionProps {
    referencedVariables: ReferencedVariable[];
}

/**
 * 引用变量展示区块
 * 显示 systemPrompt/条件表达式中检测到的变量引用状态
 */
export function ReferencedVarsSection({
    referencedVariables,
}: ReferencedVarsSectionProps) {
    if (referencedVariables.length === 0) return null;

    return (
        <div className="mb-4">
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <Link className="w-3 h-3" />
                已引用变量
            </h4>
            <div className="flex flex-wrap gap-2">
                {referencedVariables.map((ref, idx) => (
                    <Tooltip key={`ref-${idx}`}>
                        <TooltipTrigger asChild>
                            <div
                                className={`
                                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border cursor-default transition-colors
                                    ${ref.isSatisfied
                                        ? 'bg-green-50 border-green-200 text-green-700'
                                        : 'bg-orange-50 border-orange-200 text-orange-700'
                                    }
                                `}
                            >
                                {ref.isSatisfied ? (
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                ) : (
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                )}
                                <span className="font-mono font-medium">
                                    {`{{${ref.field}}}`}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                            <p>{ref.description}</p>
                            {!ref.isSatisfied && <p className="text-orange-300 mt-1">该变量在上游节点中未找到</p>}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
}
