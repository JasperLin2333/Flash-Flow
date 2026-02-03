"use client";
import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ArrowDownToLine, Copy, Check, Search, Database } from "lucide-react";
import type { UpstreamVariable } from "../types";
import { LABEL_CLASS } from "../constants";

interface AvailableVarsSectionProps {
    upstreamVariables: UpstreamVariable[];
}

/**
 * 可用输入变量区块
 * 显示上游节点提供的可引用变量列表，带复制功能
 */
export function AvailableVarsSection({
    upstreamVariables,
}: AvailableVarsSectionProps) {
    const [copiedVar, setCopiedVar] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Group variables by Node ID and filter by search query
    const groupedVars = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const groups = new Map<string, { label: string; vars: UpstreamVariable[] }>();

        upstreamVariables.forEach((v) => {
            const varName = `${v.nodeLabel}.${v.field}`;
            // Filter logic
            if (query && !varName.toLowerCase().includes(query) && !v.value?.toString().toLowerCase().includes(query)) {
                return;
            }

            if (!groups.has(v.nodeId)) {
                groups.set(v.nodeId, { label: v.nodeLabel, vars: [] });
            }
            groups.get(v.nodeId)?.vars.push(v);
        });

        return Array.from(groups.values());
    }, [upstreamVariables, searchQuery]);

    const handleCopy = async (varName: string) => {
        const textToCopy = `{{${varName}}}`;
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            setCopiedVar(varName);
            setTimeout(() => setCopiedVar(null), 1500);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h4 className={`${LABEL_CLASS} flex items-center gap-1.5`}>
                    <ArrowDownToLine className="w-3 h-3" />
                    可用输入变量
                </h4>
                {upstreamVariables.length > 5 && (
                    <div className="relative w-32">
                        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <Input
                            className="h-6 pl-6 text-[10px] bg-white"
                            placeholder="搜索变量..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {upstreamVariables.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic">无上游连接</p>
            ) : groupedVars.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic text-center py-2">未找到匹配变量</p>
            ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {groupedVars.map((group) => (
                        <div key={group.label} className="bg-white rounded-lg border border-gray-100 shadow-sm p-2">
                            <div className="flex items-center gap-1.5 mb-2 px-1">
                                <Database className="w-3 h-3 text-gray-400" />
                                <span className="text-[11px] font-semibold text-gray-700">{group.label}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {group.vars.map((v, idx) => {
                                    const varName = `${v.nodeLabel}.${v.field}`;
                                    const isCopied = copiedVar === varName;
                                    return (
                                        <Tooltip key={`${varName}-${idx}`}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => handleCopy(varName)}
                                                    className={`
                                                        group flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono transition-all
                                                        ${isCopied
                                                            ? "bg-green-50 border-green-200 text-green-700"
                                                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                                                        }
                                                    `}
                                                >
                                                    <span>{v.field}</span>
                                                    {isCopied ? (
                                                        <Check className="w-2.5 h-2.5" />
                                                    ) : (
                                                        <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50" />
                                                    )}
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                                <div className="font-semibold mb-1">{`{{${varName}}}`}</div>
                                                {v.value && <div className="text-gray-400 max-w-xs break-all">= {v.value}</div>}
                                                <div className="text-[9px] text-blue-300 mt-1">点击复制</div>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
