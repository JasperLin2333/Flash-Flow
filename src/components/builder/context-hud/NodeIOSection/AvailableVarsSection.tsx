"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ArrowDownToLine, Copy, Check } from "lucide-react";
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
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // 提取唯一的上游节点
    const uniqueNodes = React.useMemo(() => {
        const nodes = new Map<string, string>();
        upstreamVariables.forEach((v) => {
            if (!nodes.has(v.nodeId)) {
                nodes.set(v.nodeId, v.nodeLabel);
            }
        });
        return Array.from(nodes.entries()).map(([id, label]) => ({
            id,
            label,
        }));
    }, [upstreamVariables]);

    const handleCopy = (varName: string) => {
        navigator.clipboard.writeText(`{{${varName}}}`);
        setCopiedVar(varName);
        setTimeout(() => setCopiedVar(null), 1500);
    };

    const filteredVars = selectedNodeId
        ? upstreamVariables.filter((v) => v.nodeId === selectedNodeId)
        : upstreamVariables;

    return (
        <div>
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <ArrowDownToLine className="w-3 h-3" />
                可用输入变量
            </h4>

            {/* 节点筛选器 - 只有当有多个来源节点时才显示 */}
            {uniqueNodes.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                        onClick={() => setSelectedNodeId(null)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${selectedNodeId === null
                                ? "bg-blue-100 border-blue-200 text-blue-700 font-medium"
                                : "bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-600"
                            }`}
                    >
                        全部
                    </button>
                    {uniqueNodes.map((node) => (
                        <button
                            key={node.id}
                            onClick={() => setSelectedNodeId(node.id)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors max-w-[120px] truncate ${selectedNodeId === node.id
                                    ? "bg-blue-100 border-blue-200 text-blue-700 font-medium"
                                    : "bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-600"
                                }`}
                            title={node.label}
                        >
                            {node.label}
                        </button>
                    ))}
                </div>
            )}

            {upstreamVariables.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic">无上游连接</p>
            ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {filteredVars.map((v, idx) => {
                        const varName = `${v.nodeLabel}.${v.field}`;
                        const isCopied = copiedVar === varName;
                        return (
                            <div
                                key={`${v.nodeId}-${v.field}-${idx}`}
                                className="group flex items-center justify-between bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-100 hover:border-blue-200 transition-colors"
                            >
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <code className="text-[10px] font-mono text-blue-700 whitespace-nowrap cursor-default">
                                                {`{{${varName}}}`}
                                            </code>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            {`{{${varName}}}`}
                                        </TooltipContent>
                                    </Tooltip>
                                    {v.value && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-[9px] text-gray-500 truncate cursor-default">
                                                    = {v.value}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs">
                                                = {v.value}
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                    onClick={() => handleCopy(varName)}
                                >
                                    {isCopied ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                    ) : (
                                        <Copy className="w-3 h-3 text-gray-400" />
                                    )}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
