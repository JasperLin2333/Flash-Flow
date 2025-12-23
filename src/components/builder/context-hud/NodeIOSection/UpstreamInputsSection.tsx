"use client";
import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Settings } from "lucide-react";
import type { NodeKind } from "@/types/flow";
import type { UpstreamInputState } from "../types";
import { LABEL_CLASS, TOOL_IO_DEFINITIONS } from "../constants";
import type { ToolInputField } from "../types";

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
    // 获取当前工具类型的完整定义（用于判断条件显示）
    const toolType = nodeType === 'tool' ? (nodeData?.toolType as string | undefined) : undefined;
    const toolDef = toolType ? TOOL_IO_DEFINITIONS[toolType] : undefined;
    const currentInputs = (nodeData?.inputs as Record<string, unknown>) || {};

    // datetime 工具的 operation 默认值
    const DATETIME_OPERATION_DEFAULT = "now";

    // 判断字段是否应该显示（根据 dependsOn 条件）
    const shouldShowField = (fieldDef: ToolInputField | undefined): boolean => {
        if (!fieldDef?.dependsOn) return true; // 没有依赖条件，始终显示

        const { field: dependField, value: dependValue } = fieldDef.dependsOn;
        let currentValue = currentInputs[dependField];

        // 特殊处理：如果是 datetime 工具且 operation 未设置，使用默认值 "now"
        if (toolType === 'datetime' && dependField === 'operation' && !currentValue) {
            currentValue = DATETIME_OPERATION_DEFAULT;
        }

        if (Array.isArray(dependValue)) {
            return dependValue.includes(currentValue as string);
        }
        return currentValue === dependValue;
    };

    // 根据 field名称查找字段定义
    const getFieldDef = (fieldName: string): ToolInputField | undefined => {
        return toolDef?.inputs.find(inp => inp.field === fieldName);
    };

    // 渲染输入控件（textarea 或 select）
    const renderInputControl = (input: UpstreamInputState, fieldDef: ToolInputField | undefined) => {
        const fieldType = fieldDef?.type || 'text';
        const enumOptions = fieldDef?.enumOptions || [];
        const enumLabels = fieldDef?.enumLabels || {};
        const configuredValue = input.configuredValue || '';

        const handleChange = (newValue: string) => {
            if (input.isToolInput) {
                // 更新 Tool 节点的 inputs
                if (onUpdateToolInputs) {
                    const currentInputs = (nodeData?.inputs as Record<string, unknown>) || {};
                    const newInputs = { ...currentInputs, [input.field]: newValue };
                    onUpdateToolInputs(newInputs);
                }
            } else {
                // 更新其他节点的 inputMappings
                if (onUpdateInputMappings) {
                    const currentMappings = (nodeData?.inputMappings as Record<string, string>) || {};
                    const newMappings = { ...currentMappings, [input.field]: newValue };
                    onUpdateInputMappings(newMappings);
                }
            }
        };

        // 如果是枚举类型，渲染下拉选择框
        if (fieldType === 'enum' && enumOptions.length > 0) {
            return (
                <Select
                    value={configuredValue}
                    onValueChange={handleChange}
                >
                    <SelectTrigger className="w-full text-[10px] font-mono h-8 border-gray-200 bg-white focus:border-gray-400 focus:ring-1 focus:ring-gray-200">
                        <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                        {enumOptions.map((option) => (
                            <SelectItem key={option} value={option} className="text-[10px]">
                                {enumLabels[option] || option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        // 其他类型使用 textarea
        const inputType = fieldType === 'number' ? 'number' : 'text';
        return (
            <textarea
                value={configuredValue}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={fieldType === 'number' ? "输入数字" : "输入值或 {{变量名}}"}
                rows={1}
                className="w-full text-[10px] font-mono px-2 py-1.5 border rounded outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 bg-white border-gray-200 resize-y"
            />
        );
    };

    return (
        <div>
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <Settings className="w-3 h-3" />
                {nodeType === 'tool' ? '工具参数配置' : '需要的上游输入'}
            </h4>
            <div className="space-y-1.5">
                {upstreamInputs.map((input, idx) => {
                    const fieldDef = getFieldDef(input.field);

                    // 根据条件判断是否显示
                    if (!shouldShowField(fieldDef)) {
                        return null;
                    }

                    return (
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
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="text-[9px] text-gray-500 flex-1 truncate cursor-default">
                                            {input.description}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                        {input.description}
                                    </TooltipContent>
                                </Tooltip>
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
                            {/* 渲染输入控件 */}
                            {!input.field.includes('*') && renderInputControl(input, fieldDef)}
                        </div>
                    );
                })}
            </div>
            <p className="text-[9px] text-gray-400 mt-2">
                提示: 可输入固定值或使用 <code className="bg-gray-100 px-1 rounded">{`{{变量名}}`}</code> 引用上游变量
            </p>
        </div>
    );
}
