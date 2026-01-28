"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrackedSwitch } from "@/components/ui/tracked-switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronRight, GripVertical, Settings2, Asterisk } from "lucide-react";
import type { FormFieldConfig, SelectFieldConfig, MultiSelectFieldConfig } from "@/types/flow";
import { INPUT_CLASS, type StructuredFormSectionProps } from "./constants";
import { OptionsEditor } from "./OptionsEditor";

/**
 * Utility to convert label to a safe variable name slug
 */
const toVariableSlug = (label: string) => {
    return label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_') // Only allow alphanumeric and underscore
        .replace(/_+/g, '_')        // Consolidate underscores
        .replace(/^_+|_+$/g, '');   // Trim underscores
};

/**
 * FieldEditor - 单个表单字段编辑器 (Refined)
 */
function FieldEditor({
    field,
    index,
    onUpdate,
    onDelete,
    onTypeChange,
}: {
    field: FormFieldConfig;
    index: number;
    onUpdate: (index: number, updates: Partial<FormFieldConfig>) => void;
    onDelete: (index: number) => void;
    onTypeChange: (index: number, newType: "select" | "text" | "multi-select") => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-generate name logic
    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newLabel = e.target.value;
        const updates: Partial<FormFieldConfig> = { label: newLabel };
        // Only auto-generate name if it's completely empty (new field)
        // Once a name is set, it should remain stable
        if (field.name === '') {
            const slug = toVariableSlug(newLabel);
            if (slug) {
                updates.name = `${slug}_${Date.now().toString().slice(-4)}`;
            }
        }
        onUpdate(index, updates);
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'select': return '单选 (Select)';
            case 'multi-select': return '多选 (Multi-Select)';
            case 'text': return '文本 (Text)';
            default: return type;
        }
    };

    return (
        <div className={`
            group rounded-lg border transition-all duration-200 overflow-hidden
            ${isExpanded 
                ? "bg-white border-blue-200 shadow-md ring-1 ring-blue-50" 
                : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
            }
        `}>
            {/* Header / Summary Row */}
            <div 
                className="flex items-center gap-3 p-3 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Drag Handle (Visual only for now) */}
                <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Expand Toggle */}
                <div className={`
                    p-0.5 rounded transition-transform duration-200 text-gray-400
                    ${isExpanded ? "rotate-90 text-blue-500" : "group-hover:text-gray-600"}
                `}>
                    <ChevronRight className="w-4 h-4" />
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                        {field.label || <span className="text-gray-400 italic">未命名字段</span>}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                        {getTypeLabel(field.type)}
                    </span>
                    {field.required && (
                        <span className="text-[10px] flex items-center gap-0.5 text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded">
                            <Asterisk className="w-2 h-2" />
                            必填
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(index);
                        }}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Expanded Configuration */}
            {isExpanded && (
                <div className="px-4 pb-4 pt-0 space-y-4 animate-in slide-in-from-top-1 fade-in duration-200">
                    <div className="h-px bg-gray-100 mb-4" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        {/* Field Label */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight px-0.5">参数显示名称</label>
                            <Input
                                value={field.label}
                                onChange={handleLabelChange}
                                placeholder="例如：请填写您的姓名"
                                className="h-8 text-xs bg-gray-50/50 focus:bg-white transition-colors"
                            />
                        </div>

                        {/* Field Type Selector */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight px-0.5">参数类型</label>
                            <Select
                                value={field.type}
                                onValueChange={(value: "select" | "text" | "multi-select") =>
                                    onTypeChange(index, value)
                                }
                            >
                                <SelectTrigger size="sm" className="h-8 text-xs bg-gray-50/50 focus:bg-white transition-colors">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">文本 (Text)</SelectItem>
                                    <SelectItem value="select">单选 (Select)</SelectItem>
                                    <SelectItem value="multi-select">多选 (Multi-Select)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Advanced Settings Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Field Name - Variable Identity */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-0.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">参数标识符 (ID)</label>
                                <span className="text-[9px] text-gray-400 font-mono">variable_name</span>
                            </div>
                            <Input
                                value={field.name}
                                onChange={(e) => onUpdate(index, { name: e.target.value })}
                                placeholder="field_name"
                                className="h-8 font-mono text-[11px] bg-gray-50/50 focus:bg-white transition-colors text-gray-600"
                            />
                        </div>

                        {/* Required Toggle */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight px-0.5 block">校验规则</label>
                            <div className="flex items-center gap-2 h-8 px-2 rounded-lg border border-gray-100 bg-gray-50/50">
                                <TrackedSwitch
                                    id={`req-${field.name}`}
                                    trackingName="field_required"
                                    nodeType="input_field"
                                    checked={field.required}
                                    onCheckedChange={(checked) => onUpdate(index, { required: checked })}
                                    className="scale-75 origin-left"
                                />
                                <label htmlFor={`req-${field.name}`} className="text-xs text-gray-600 cursor-pointer select-none">
                                    设为必填
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Type-specific fields */}
                    {(field.type === "select" || field.type === "multi-select") && (
                        <div className="space-y-2 pt-2 border-t border-gray-100 border-dashed">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight px-0.5 flex items-center gap-1">
                                <Settings2 className="w-3 h-3" />
                                选项配置
                            </label>
                            <OptionsEditor
                                options={(field as SelectFieldConfig | MultiSelectFieldConfig).options}
                                onChange={(options) => onUpdate(index, { options })}
                                placeholder="输入选项内容，按回车键添加..."
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * StructuredFormSection - 结构化表单配置区块 (Refined)
 */
export function StructuredFormSection({
    enabled,
    formFields,
    onAddField,
    onDeleteField,
    onFieldUpdate,
    onFieldTypeChange,
}: StructuredFormSectionProps) {
    if (!enabled) return null;

    return (
        <div className="space-y-3 pt-1 animate-in slide-in-from-top-1 fade-in duration-200">
            <div className="space-y-2">
                {formFields.map((field, index) => (
                    <FieldEditor
                        key={field.name || index}
                        field={field}
                        index={index}
                        onUpdate={onFieldUpdate}
                        onDelete={onDeleteField}
                        onTypeChange={onFieldTypeChange}
                    />
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddField}
                className="w-full h-9 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 transition-all rounded-lg text-xs font-medium text-gray-500"
            >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                添加新的输入字段
            </Button>
        </div>
    );
}
