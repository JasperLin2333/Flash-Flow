"use client";
import React from "react";
import { Settings } from "lucide-react";
import type { OutputInputMappings } from "@/types/flow";
import type { NodeIOSectionProps } from "../types";
import { LABEL_CLASS } from "../constants";
import { OutputNodeConfig } from "../OutputNodeConfig";
import { useNodeIO } from "./hooks/useNodeIO";
import { UpstreamInputsSection } from "./UpstreamInputsSection";
import { ReferencedVarsSection } from "./ReferencedVarsSection";
import { AvailableVarsSection } from "./AvailableVarsSection";
import { OutputParamsSection } from "./OutputParamsSection";

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

    return (
        <div className="space-y-4 mt-6 pt-5 border-t border-gray-100">
            {/* Output 节点专用配置 */}
            {nodeType === 'output' && onUpdateInputMappings && (
                <div>
                    <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                        <Settings className="w-3 h-3" />
                        输出配置
                    </h4>
                    <OutputNodeConfig
                        inputMappings={nodeData?.inputMappings as OutputInputMappings | undefined}
                        onUpdateInputMappings={(mappings) => onUpdateInputMappings(mappings)}
                        isExecuting={nodeData?.status === 'running'}
                    />
                </div>
            )}

            {/* 1. 需要的上游输入（Tool 节点可编辑，但不包括 output 节点） */}
            {!isEntryNode && nodeType !== 'output' && upstreamInputs.length > 0 && (
                <UpstreamInputsSection
                    nodeType={nodeType}
                    nodeData={nodeData}
                    upstreamInputs={upstreamInputs}
                    onUpdateToolInputs={onUpdateToolInputs}
                    onUpdateInputMappings={onUpdateInputMappings}
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
    );
}
