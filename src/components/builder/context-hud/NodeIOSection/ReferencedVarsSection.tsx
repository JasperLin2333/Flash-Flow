"use client";
import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Check, Link } from "lucide-react";
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
    return (
        <div>
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <Link className="w-3 h-3" />
                引用的变量
            </h4>
            <div className="space-y-1.5">
                {referencedVariables.map((ref, idx) => (
                    <div
                        key={`ref-${idx}`}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border ${ref.isSatisfied
                            ? 'bg-green-50 border-green-200'
                            : 'bg-orange-50 border-orange-200'
                            }`}
                    >
                        <code className={`text-[10px] font-mono shrink-0 ${ref.isSatisfied ? 'text-green-700' : 'text-orange-700'
                            }`}>
                            {`{{${ref.field}}}`}
                        </code>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-[9px] text-gray-500 flex-1 truncate cursor-default">
                                    {ref.description}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                                {ref.description}
                            </TooltipContent>
                        </Tooltip>
                        {ref.isSatisfied ? (
                            <Check className="w-3 h-3 text-green-500 shrink-0" />
                        ) : (
                            <span className="text-[9px] text-orange-500 shrink-0">未匹配</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
