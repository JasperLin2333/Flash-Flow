"use client";
import React, { useRef, useEffect } from "react";
import { Plus, ChevronDown, Trash2 } from "lucide-react";
import type { OutputMode, ContentSource, AttachmentSource, OutputInputMappings } from "@/types/flow";
import { FormSeparator, NODE_FORM_STYLES } from "../node-forms/shared";
import { OUTPUT_MODE_OPTIONS } from "@/lib/outputModeConstants";

const {
    LABEL: LABEL_CLASS,
    CARD_SPACING,
    REMOVE_BUTTON,
    ADD_BUTTON
} = NODE_FORM_STYLES;

// 使用共享常量
const MODE_OPTIONS = OUTPUT_MODE_OPTIONS;

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

    const normalizedSources = sources.map((s) => (s?.value || "").trim()).filter(Boolean);
    const sourceError =
        mode === 'template'
            ? null
            : mode === 'direct'
                ? ((sources[0]?.value || "").trim() ? null : 'direct 模式需要配置 1 个内容来源')
                : (normalizedSources.length > 0 ? null : '请至少配置 1 个内容来源');
    const templateError = mode === 'template' && !template.trim() ? 'template 模式需要填写输出模板' : null;

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
        // 类型隔离：根据目标模式决定保留哪些字段
        const isSourceMode = ['direct', 'select', 'merge'].includes(newMode);
        const isTemplateMode = newMode === 'template';

        let newSources: ContentSource[] = [];
        let newTemplate = '';

        if (isSourceMode) {
            // sources 类模式：保留现有 sources
            newSources = sources.length > 0 ? [...sources] : [];
            // direct 模式只保留第一个
            if (newMode === 'direct' && newSources.length > 1) {
                newSources = newSources.slice(0, 1);
            }
            // 清空 template（不相关字段）
            newTemplate = '';
        } else if (isTemplateMode) {
            // template 模式：保留现有 template，清空 sources
            newTemplate = template || '';
            newSources = [];
        }

        updateMappings({
            mode: newMode,
            sources: newSources,
            template: newTemplate,
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
                <label className={`${LABEL_CLASS} mb-2 block`}>
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
                    <label className={`${LABEL_CLASS} mb-2 block`}>
                        输出模板
                    </label>
                    <textarea
                        value={template}
                        onChange={(e) => updateMappings({ template: e.target.value })}
                        placeholder="输入模板内容，使用 {{变量名}} 或 {{节点名.字段}} 引用变量&#10;&#10;例如:&#10;## 用户问题&#10;{{user_input}}&#10;&#10;## AI 回复&#10;{{LLM处理.response}}"
                        disabled={isExecuting}
                        className={`w-full min-h-32 text-xs px-3 py-2 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 resize-y font-mono ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                    />
                    {templateError && (
                        <p className="text-[10px] text-red-500 mt-1 pl-1">
                            {templateError}
                        </p>
                    )}
                    <p className="text-[9px] text-gray-400 mt-1">
                        支持 <code className="bg-gray-100 px-1 rounded">{"{{变量名}}"}</code> 或 <code className="bg-gray-100 px-1 rounded">{"{{节点名.字段}}"}</code> 语法
                    </p>
                </div>
            ) : (
                // 其他模式：显示 sources 配置
                <div>
                    <label className={`${LABEL_CLASS} mb-2 block`}>
                        内容来源 {mode === 'direct' && '(单个)'} {mode === 'select' && '(优先级顺序)'} {mode === 'merge' && '(合并顺序)'}
                    </label>
                    <div className={`${CARD_SPACING}`}>
                        {/* 始终显示主来源 Slot - Direct 模式仅显示此一个 */}
                        <div className="flex items-center group">
                            {/* Input */}
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={sources[0]?.value || ""}
                                    onChange={(e) => handleUpdateSource(0, e.target.value)}
                                    placeholder="{{变量名}}"
                                    disabled={isExecuting}
                                    className={`w-full h-8 text-xs px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono transition-all placeholder:text-gray-300 ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white'}`}
                                />
                                {sources[0]?.value && !isExecuting && (
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateSource(0, "")}
                                        className={`absolute right-1 top-1/2 -translate-y-1/2 ${REMOVE_BUTTON}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 其他来源 Slot - 仅在非 Direct 模式下显示 */}
                        {mode !== 'direct' && (
                            <>
                                {sources.slice(1).map((source, idx) => {
                                    const actualIndex = idx + 1;
                                    return (
                                        <div key={actualIndex} className="flex items-center group animate-in fade-in slide-in-from-top-1 duration-200">
                                            {/* Input */}
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={source.value}
                                                    onChange={(e) => handleUpdateSource(actualIndex, e.target.value)}
                                                    placeholder="{{变量名}}"
                                                    disabled={isExecuting}
                                                    className={`w-full h-8 text-xs px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono transition-all placeholder:text-gray-300 ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white'}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSource(actualIndex)}
                                                    disabled={isExecuting}
                                                    className={`absolute right-1 top-1/2 -translate-y-1/2 ${REMOVE_BUTTON}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* 添加按钮 */}
                                <button
                                    type="button"
                                    className={ADD_BUTTON}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddSource(); }}
                                    disabled={isExecuting}
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    添加来源
                                </button>
                            </>
                        )}
                    </div>

                    {sourceError && (
                        <p className="text-[10px] text-red-500 mt-1 pl-1">
                            {sourceError}
                        </p>
                    )}
                    {mode === 'select' && (
                        <p className="text-[9px] text-gray-400 mt-1 pl-1">
                            💡 按顺序检查，使用第一个非空结果作为输出
                        </p>
                    )}
                    {mode === 'merge' && (
                        <p className="text-[9px] text-gray-400 mt-1 pl-1">
                            💡 合并所有非空结果，默认用双换行分隔
                        </p>
                    )}
                </div>
            )}

            {/* 附件配置 */}
            <FormSeparator />
            <div>
                <label className={`${LABEL_CLASS} mb-2 block`}>
                    附件 (可选)
                </label>
                <div className={`${CARD_SPACING}`}>
                    {/* 附件列表 */}
                    {attachments.map((attachment, idx) => (
                        <div key={idx} className="flex items-center group animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* Input */}
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={attachment.value}
                                    onChange={(e) => handleUpdateAttachment(idx, e.target.value)}
                                    placeholder="{{文件URL变量}}"
                                    disabled={isExecuting}
                                    className={`w-full h-8 text-xs px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono transition-all placeholder:text-gray-300 ${isExecuting ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveAttachment(idx)}
                                    disabled={isExecuting}
                                    className={`absolute right-1 top-1/2 -translate-y-1/2 ${REMOVE_BUTTON}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* 添加按钮 */}
                    <button
                        type="button"
                        className={ADD_BUTTON}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddAttachment(); }}
                        disabled={isExecuting}
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        添加附件来源
                    </button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1 pl-1">
                    引用文件URL变量
                </p>
            </div>


        </div>
    );
}
