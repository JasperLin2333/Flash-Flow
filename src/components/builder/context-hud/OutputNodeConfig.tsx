"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronDown } from "lucide-react";
import type { OutputMode, ContentSource, AttachmentSource, OutputInputMappings } from "@/types/flow";

const MODE_OPTIONS: { value: OutputMode; label: string; description: string }[] = [
    { value: 'direct', label: '直接引用', description: '从单一上游节点获取输出' },
    { value: 'select', label: '分支选择', description: '从多个来源中选择第一个非空结果' },
    { value: 'merge', label: '内容合并', description: '将多个来源的内容合并输出' },
    { value: 'template', label: '模板渲染', description: '自定义输出格式模板' },
];

interface OutputNodeConfigProps {
    inputMappings?: OutputInputMappings;
    onUpdateInputMappings: (mappings: OutputInputMappings) => void;
}

export function OutputNodeConfig({
    inputMappings,
    onUpdateInputMappings,
}: OutputNodeConfigProps) {
    const mode = inputMappings?.mode || 'direct';
    const sources = inputMappings?.sources || [];
    const template = inputMappings?.template || '';
    const attachments = inputMappings?.attachments || [];

    const [showModeDropdown, setShowModeDropdown] = React.useState(false);

    const updateMappings = (updates: Partial<OutputInputMappings>) => {
        onUpdateInputMappings({
            mode,
            sources,
            template,
            attachments,
            ...updates,
        });
    };

    const handleModeChange = (newMode: OutputMode) => {
        updateMappings({ mode: newMode });
        setShowModeDropdown(false);
    };

    const handleAddSource = () => {
        const newSource: ContentSource = { type: 'variable', value: '' };
        updateMappings({ sources: [...sources, newSource] });
    };

    const handleUpdateSource = (index: number, value: string) => {
        const newSources = [...sources];
        newSources[index] = { ...newSources[index], value };
        updateMappings({ sources: newSources });
    };

    const handleRemoveSource = (index: number) => {
        const newSources = sources.filter((_, i) => i !== index);
        updateMappings({ sources: newSources });
    };

    const handleAddAttachment = () => {
        const newAttachment: AttachmentSource = { type: 'variable', value: '' };
        updateMappings({ attachments: [...attachments, newAttachment] });
    };

    const handleUpdateAttachment = (index: number, value: string) => {
        const newAttachments = [...attachments];
        newAttachments[index] = { ...newAttachments[index], value };
        updateMappings({ attachments: newAttachments });
    };

    const handleRemoveAttachment = (index: number) => {
        const newAttachments = attachments.filter((_, i) => i !== index);
        updateMappings({ attachments: newAttachments });
    };

    const currentModeOption = MODE_OPTIONS.find(m => m.value === mode) || MODE_OPTIONS[0];

    return (
        <div className="space-y-3">
            {/* 模式选择器 */}
            <div className="relative">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                    输出模式
                </label>
                <button
                    onClick={() => setShowModeDropdown(!showModeDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white border rounded-lg hover:border-blue-300 transition-colors"
                >
                    <div className="text-left">
                        <span className="font-medium text-gray-900">{currentModeOption.label}</span>
                        <span className="text-[10px] text-gray-500 ml-2">{currentModeOption.description}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showModeDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                        {MODE_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleModeChange(option.value)}
                                className={`w-full px-3 py-2 text-left hover:bg-blue-50 first:rounded-t-lg last:rounded-b-lg ${mode === option.value ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <span className="font-medium text-gray-900 text-sm">{option.label}</span>
                                <span className="text-[10px] text-gray-500 block">{option.description}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 根据模式显示不同的配置 UI */}
            {mode === 'template' ? (
                // 模板模式：显示模板编辑器
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                        输出模板
                    </label>
                    <textarea
                        value={template}
                        onChange={(e) => updateMappings({ template: e.target.value })}
                        placeholder="输入模板内容，使用 {{变量名}} 或 {{节点名.字段}} 引用变量&#10;&#10;例如:&#10;## 用户问题&#10;{{user_input}}&#10;&#10;## AI 回复&#10;{{LLM处理.response}}"
                        className="w-full h-32 text-xs px-3 py-2 border rounded-lg outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 resize-none font-mono"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">
                        支持 <code className="bg-gray-100 px-1 rounded">{"{{变量名}}"}</code> 或 <code className="bg-gray-100 px-1 rounded">{"{{节点名.字段}}"}</code> 语法
                    </p>
                </div>
            ) : (
                // 其他模式：显示 sources 配置
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                        内容来源 {mode === 'direct' && '(单个)'} {mode === 'select' && '(优先级顺序)'} {mode === 'merge' && '(合并顺序)'}
                    </label>
                    <div className="space-y-2">
                        {sources.map((source, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 w-4 shrink-0">{idx + 1}.</span>
                                <input
                                    type="text"
                                    value={source.value}
                                    onChange={(e) => handleUpdateSource(idx, e.target.value)}
                                    placeholder="{{节点名.字段}} 或 {{response}}"
                                    className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 font-mono"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => handleRemoveSource(idx)}
                                >
                                    <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                                </Button>
                            </div>
                        ))}
                        {(mode !== 'direct' || sources.length === 0) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-7 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300"
                                onClick={handleAddSource}
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                添加来源
                            </Button>
                        )}
                    </div>
                    {mode === 'select' && (
                        <p className="text-[9px] text-gray-400 mt-1">
                            按顺序检查，使用第一个非空结果
                        </p>
                    )}
                    {mode === 'merge' && (
                        <p className="text-[9px] text-gray-400 mt-1">
                            合并所有非空结果，用双换行分隔
                        </p>
                    )}
                </div>
            )}

            {/* 附件配置 */}
            <div className="pt-2 border-t border-gray-100">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                    附件 (可选)
                </label>
                <div className="space-y-2">
                    {attachments.map((attachment, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={attachment.value}
                                onChange={(e) => handleUpdateAttachment(idx, e.target.value)}
                                placeholder="{{用户输入.files}}"
                                className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 font-mono"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleRemoveAttachment(idx)}
                            >
                                <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                            </Button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300"
                        onClick={handleAddAttachment}
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        添加附件来源
                    </Button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">
                    引用上游文件变量（如 <code className="bg-gray-100 px-1 rounded">{"{{用户输入.files}}"}</code>）
                </p>
            </div>


        </div>
    );
}
