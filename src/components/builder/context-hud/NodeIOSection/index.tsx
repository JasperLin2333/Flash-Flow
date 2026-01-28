"use client";
import React, { useState } from "react";
import { Settings, Workflow, ArrowRightLeft } from "lucide-react";
import type { OutputInputMappings } from "@/types/flow";
import type { NodeIOSectionProps } from "../types";
import { OutputNodeConfig } from "../OutputNodeConfig";
import { useNodeIO } from "./hooks/useNodeIO";
import { UpstreamInputsSection } from "./UpstreamInputsSection";
import { ReferencedVarsSection } from "./ReferencedVarsSection";
import { AvailableVarsSection } from "./AvailableVarsSection";
import { OutputParamsSection } from "./OutputParamsSection";
import { CapabilityItem } from "../../node-forms/shared";

/**
 * 节点输入输出参数显示组件
 * 主入口 - 组装所有子组件
 */
export function NodeIOSection({
    nodeId,
    nodeType,
    nodeLabel,
    nodeData,
    nodes,
    edges,
    flowContext,
    onUpdateToolInputs,
    onUpdateInputMappings,
}: NodeIOSectionProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    // 使用 hook 获取所有计算结果
    const {
        upstreamVariables,
        outputFields,
        upstreamInputs,
        referencedVariables,
        isEntryNode,
    } = useNodeIO({
        nodeId,
        nodeType,
        nodeData,
        nodes,
        edges,
        flowContext,
    });

    const hasContent = (nodeType === 'output' && onUpdateInputMappings) ||
                       (!isEntryNode && nodeType !== 'output' && upstreamInputs.length > 0) ||
                       (referencedVariables.length > 0) ||
                       (!isEntryNode && upstreamVariables.length > 0) ||
                       (outputFields.length > 0);

    if (!hasContent) return null;

    return (
        <div className="mt-6 pt-2 border-t border-gray-100/50">
             <CapabilityItem
                icon={<ArrowRightLeft className="w-4 h-4" />}
                iconColorClass="bg-teal-50 text-teal-600"
                title="数据流向"
                description="变量与字段映射"
                isExpanded={isExpanded}
                rightElement={
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                        {isExpanded ? "收起" : "展开"}
                    </button>
                }
            >
                <div className="space-y-6 pt-2 pb-2 px-1">
                    {/* Output 节点专用配置 */}
                    {nodeType === 'output' && onUpdateInputMappings && (
                        <OutputNodeConfig
                            inputMappings={nodeData?.inputMappings as OutputInputMappings | undefined}
                            onUpdateInputMappings={(mappings) => onUpdateInputMappings(mappings)}
                            isExecuting={nodeData?.status === 'running'}
                        />
                    )}

                    {/* 1. 参数配置（用户手动配置，不包括 output 节点和 tool 节点） */}
                    {!isEntryNode && nodeType !== 'output' && nodeType !== 'tool' && upstreamInputs.length > 0 && (
                        <UpstreamInputsSection
                            nodeType={nodeType}
                            nodeData={nodeData}
                            upstreamInputs={upstreamInputs}
                            onUpdateToolInputs={onUpdateToolInputs}
                            onUpdateInputMappings={onUpdateInputMappings}
                            hiddenFields={
                                nodeType === 'llm' ? ['user_input'] :
                                nodeType === 'rag' ? ['query'] : []
                            }
                        />
                    )}

                    {/* 2. 引用的变量 */}
                    {referencedVariables.length > 0 && (
                        <ReferencedVarsSection referencedVariables={referencedVariables} />
                    )}

                    {/* 3. 可用输入变量 */}
                    {!isEntryNode && (
                        <AvailableVarsSection upstreamVariables={upstreamVariables} />
                    )}

                    {/* 4. 输出参数 */}
                    <OutputParamsSection
                        nodeLabel={nodeLabel}
                        outputFields={outputFields}
                    />
                </div>
            </CapabilityItem>
        </div>
    );
}
