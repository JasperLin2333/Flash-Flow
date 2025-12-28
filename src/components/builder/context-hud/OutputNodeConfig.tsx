"use client";
import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronDown } from "lucide-react";
import type { OutputMode, ContentSource, AttachmentSource, OutputInputMappings } from "@/types/flow";

const MODE_OPTIONS: { value: OutputMode; label: string; description: string }[] = [
    { value: 'direct', label: '直接引用', description: '从单一上游节点获取输出' },
    { value: 'select', label: '分支选择', description: '从多个来源中选择第一个非空结果' },
    { value: 'merge', label: '内容合并', description: '将多个来源的内容合并输出' },
    { value: 'template', label: '模板渲染', description: '自定义输出格式模板(非流式输出)' },
];

interface OutputNodeConfigProps {
    inputMappings?: OutputInputMappings;
    onUpdateInputMappings: (mappings: OutputInputMappings) => void;
    isExecuting?: boolean;
}

export function OutputNodeConfig({
    inputMappings,
    onUpdateInputMappings,
    isExecuting = false,
}: OutputNodeConfigProps) {
    const mode = inputMappings?.mode || 'direct';
    const sources = inputMappings?.sources || [];
    const template = inputMappings?.template || '';
    const attachments = inputMappings?.attachments || [];

    const [showModeDropdown, setShowModeDropdown] = React.useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowModeDropdown(false);
            }
        };

        if (showModeDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showModeDropdown]);

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
        let newSources = sources;

        // 如果切换到直连模式，只能保留一个 source
        if (newMode === 'direct') {
            newSources = sources.slice(0, 1);
        }

        updateMappings({
            mode: newMode,
            sources: newSources
        });
        setShowModeDropdown(false);
    };

    const handleAddSource = () => {
        const newSource: ContentSource = { type: 'variable', value: '' };
        updateMappings({ sources: [...sources, newSource] });
    };

    const handleUpdateSource = (index: number, value: string) => {
        const newSources = [...sources];
        if (!newSources[index]) {
            newSources[index] = { type: 'variable', value: '' };
        }
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
            <div className="relative" ref={dropdownRef}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                    输出模式
                </label>
                <button
                    onClick={() => !isExecuting && setShowModeDropdown(!showModeDropdown)}
                    disabled={isExecuting}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white border rounded-lg transition-colors ${isExecuting ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}`}
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
                                className={`w-full px-3 py-2 text-left hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${mode === option.value ? 'bg-gray-100' : ''
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
                        disabled={isExecuting}
                        className={`w-full min-h-32 text-xs px-3 py-2 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 resize-y font-mono ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
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
                        {/* 如果 sources 为空，默认显示一个输入框 */}
                        {sources.length === 0 ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={sources[0]?.value || ""}
                                    onChange={(e) => handleUpdateSource(0, e.target.value)}
                                    placeholder="{{节点名.字段}} 或 {{response}}"
                                    disabled={isExecuting}
                                    className={`flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                                />
                                <div className="w-6 h-6 shrink-0" /> {/* 占位符，保持对齐 */}
                            </div>
                        ) : (
                            sources.map((source, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={source.value}
                                        onChange={(e) => handleUpdateSource(idx, e.target.value)}
                                        placeholder="{{节点名.字段}} 或 {{response}}"
                                        disabled={isExecuting}
                                        className={`flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => handleRemoveSource(idx)}
                                        disabled={isExecuting}
                                    >
                                        <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                                    </Button>
                                </div>
                            ))
                        )}
                        {(mode !== 'direct' || sources.length === 0) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-7 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300"
                                onClick={handleAddSource}
                                disabled={isExecuting}
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
                                disabled={isExecuting}
                                className={`flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleRemoveAttachment(idx)}
                                disabled={isExecuting}
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
                        disabled={isExecuting}
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        添加附件来源
                    </Button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">
                    引用文件变量（如 <code className="bg-gray-100 px-1 rounded">{`{{用户输入.files}}`}</code> 或 <code className="bg-gray-100 px-1 rounded">{`{{代码执行.generatedFile}}`}</code>）
                </p>
            </div>


        </div>
    );
}
