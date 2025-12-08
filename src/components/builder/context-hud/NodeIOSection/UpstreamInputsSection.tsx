"use client";
import React from "react";
import { Check, Settings } from "lucide-react";
import type { NodeKind } from "@/types/flow";
import type { UpstreamInputState } from "../types";
import { LABEL_CLASS } from "../constants";

interface UpstreamInputsSectionProps {
    nodeType: NodeKind;
    nodeData?: Record<string, unknown>;
    upstreamInputs: UpstreamInputState[];
    onUpdateToolInputs?: (inputs: Record<string, unknown>) => void;
    onUpdateInputMappings?: (mappings: Record<string, string>) => void;
}

/**
 * 上游输入配置区块
 * 显示并编辑工具参数或 inputMappings
 */
export function UpstreamInputsSection({
    nodeType,
    nodeData,
    upstreamInputs,
    onUpdateToolInputs,
    onUpdateInputMappings,
}: UpstreamInputsSectionProps) {
    return (
        <div>
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <Settings className="w-3 h-3" />
                {nodeType === 'tool' ? '工具参数配置' : '需要的上游输入'}
            </h4>
            <div className="space-y-1.5">
                {upstreamInputs.map((input, idx) => (
                    <div
                        key={`upstream-${idx}`}
                        className={`rounded-lg px-2.5 py-1.5 border ${input.hasInvalidVars
                            ? 'bg-red-50 border-red-200'
                            : input.isSatisfied
                                ? 'bg-green-50 border-green-200'
                                : input.required
                                    ? 'bg-orange-50 border-orange-200'
                                    : 'bg-gray-50 border-gray-200'
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <code className={`text-[10px] font-mono shrink-0 ${input.hasInvalidVars
                                ? 'text-red-700'
                                : input.isSatisfied
                                    ? 'text-green-700'
                                    : input.required
                                        ? 'text-orange-700'
                                        : 'text-gray-600'
                                }`}>
                                {input.field}{input.required ? ' *' : ''}
                            </code>
                            <span className="text-[9px] text-gray-500 flex-1 truncate">
                                {input.description}
                            </span>
                            {input.hasInvalidVars ? (
                                <span className="text-[9px] text-red-500 shrink-0">变量无效</span>
                            ) : input.isSatisfied ? (
                                <Check className="w-3 h-3 text-green-500 shrink-0" />
                            ) : input.required ? (
                                <span className="text-[9px] text-orange-500 shrink-0">需配置</span>
                            ) : (
                                <span className="text-[9px] text-gray-400 shrink-0">可选</span>
                            )}
                        </div>
                        {/* 所有节点都显示可编辑输入框 */}
                        {!input.field.includes('*') && (
                            <input
                                type="text"
                                value={input.configuredValue || ''}
                                onChange={(e) => {
                                    if (input.isToolInput) {
                                        // 更新 Tool 节点的 inputs
                                        if (onUpdateToolInputs) {
                                            const currentInputs = (nodeData?.inputs as Record<string, unknown>) || {};
                                            const newInputs = { ...currentInputs, [input.field]: e.target.value };
                                            onUpdateToolInputs(newInputs);
                                        }
                                    } else {
                                        // 更新其他节点的 inputMappings
                                        if (onUpdateInputMappings) {
                                            const currentMappings = (nodeData?.inputMappings as Record<string, string>) || {};
                                            const newMappings = { ...currentMappings, [input.field]: e.target.value };
                                            onUpdateInputMappings(newMappings);
                                        }
                                    }
                                }}
                                placeholder="输入值或 {{变量名}}"
                                className="w-full text-[10px] px-2 py-1 border rounded outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 bg-white border-gray-200"
                            />
                        )}
                    </div>
                ))}
            </div>
            <p className="text-[9px] text-gray-400 mt-2">
                提示: 可输入固定值或使用 <code className="bg-gray-100 px-1 rounded">{`{{变量名}}`}</code> 引用上游变量
            </p>
        </div>
    );
}
