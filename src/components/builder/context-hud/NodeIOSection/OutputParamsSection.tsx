"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpFromLine, Plus, X, Check } from "lucide-react";
import type { OutputField } from "./hooks/useNodeIO";
import { LABEL_CLASS } from "../constants";

interface OutputParamsSectionProps {
    nodeLabel?: string;
    outputFields: OutputField[];
    customOutputs?: { name: string; value: string }[];
    onUpdateCustomOutputs: (outputs: { name: string; value: string }[]) => void;
}

/**
 * 输出参数区块
 * 显示系统预定义输出字段和用户自定义变量编辑器
 */
export function OutputParamsSection({
    nodeLabel,
    outputFields,
    customOutputs,
    onUpdateCustomOutputs,
}: OutputParamsSectionProps) {
    const [newVarName, setNewVarName] = useState("");
    const [newVarValue, setNewVarValue] = useState("");
    const [isAddingVar, setIsAddingVar] = useState(false);

    const handleAddCustomVar = () => {
        if (!newVarName.trim()) return;

        const newOutputs = [...(customOutputs || []), { name: newVarName.trim(), value: newVarValue }];
        onUpdateCustomOutputs(newOutputs);
        setNewVarName("");
        setNewVarValue("");
        setIsAddingVar(false);
    };

    const handleDeleteCustomVar = (index: number) => {
        const newOutputs = (customOutputs || []).filter((_, i) => i !== index);
        onUpdateCustomOutputs(newOutputs);
    };

    const handleUpdateCustomVar = (index: number, name: string, value: string) => {
        const newOutputs = [...(customOutputs || [])];
        newOutputs[index] = { name, value };
        onUpdateCustomOutputs(newOutputs);
    };

    return (
        <div>
            <h4 className={`${LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
                <ArrowUpFromLine className="w-3 h-3" />
                输出参数
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
                        <span className="text-[9px] text-gray-500 truncate">
                            {f.description}
                        </span>
                    </div>
                ))}

                {/* 用户自定义的输出变量 */}
                {customOutputs && customOutputs.map((cv, idx) => (
                    <div
                        key={`custom-${idx}`}
                        className="group flex items-center gap-2 bg-purple-50 rounded-lg px-2.5 py-1.5 border border-purple-100"
                    >
                        <input
                            type="text"
                            value={cv.name}
                            onChange={(e) => handleUpdateCustomVar(idx, e.target.value, cv.value)}
                            className="text-[10px] font-mono text-purple-700 bg-transparent border-none outline-none w-20 shrink-0"
                            placeholder="变量名"
                        />
                        <span className="text-[9px] text-gray-400">=</span>
                        <input
                            type="text"
                            value={cv.value}
                            onChange={(e) => handleUpdateCustomVar(idx, cv.name, e.target.value)}
                            className="text-[9px] text-gray-600 bg-transparent border-none outline-none flex-1 min-w-0"
                            placeholder="默认值"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => handleDeleteCustomVar(idx)}
                        >
                            <X className="w-3 h-3 text-red-400" />
                        </Button>
                    </div>
                ))}

                {/* 添加新变量的表单 */}
                {isAddingVar ? (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-200">
                        <input
                            type="text"
                            value={newVarName}
                            onChange={(e) => setNewVarName(e.target.value)}
                            className="text-[10px] font-mono text-gray-700 bg-transparent border-none outline-none w-20 shrink-0"
                            placeholder="变量名"
                            autoFocus
                        />
                        <span className="text-[9px] text-gray-400">=</span>
                        <input
                            type="text"
                            value={newVarValue}
                            onChange={(e) => setNewVarValue(e.target.value)}
                            className="text-[9px] text-gray-600 bg-transparent border-none outline-none flex-1 min-w-0"
                            placeholder="默认值（可选）"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomVar()}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0"
                            onClick={handleAddCustomVar}
                        >
                            <Check className="w-3 h-3 text-green-500" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0"
                            onClick={() => { setIsAddingVar(false); setNewVarName(""); setNewVarValue(""); }}
                        >
                            <X className="w-3 h-3 text-gray-400" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300"
                        onClick={() => setIsAddingVar(true)}
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        添加自定义变量
                    </Button>
                )}
            </div>
            {nodeLabel && (
                <p className="text-[9px] text-gray-400 mt-2">
                    下游引用格式: <code className="bg-gray-100 px-1 rounded">{`{{${nodeLabel}.字段名}}`}</code>
                </p>
            )}
        </div>
    );
}
