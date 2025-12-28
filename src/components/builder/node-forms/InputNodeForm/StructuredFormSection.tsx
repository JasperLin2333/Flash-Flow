"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { FormFieldConfig, SelectFieldConfig, MultiSelectFieldConfig } from "@/types/flow";
import { INPUT_CLASS, SECTION_TITLE_CLASS, type StructuredFormSectionProps } from "./constants";

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
 * FieldEditor - 单个表单字段编辑器
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
    return (
        <div className="p-3 bg-white hover:bg-gray-50/80 transition-colors rounded-xl border border-gray-100 shadow-sm space-y-4 group">
            <div className="flex items-center justify-between text-gray-400">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-5 h-5 bg-gray-100 rounded text-[10px] font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        {index + 1}
                    </div>
                    <span className="text-[11px] font-bold text-gray-700">字段配置</span>
                    <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-100">
                        <Switch
                            id={`req-${field.name}`}
                            checked={field.required}
                            onCheckedChange={(checked) => onUpdate(index, { required: checked })}
                            className="scale-75"
                        />
                        <label htmlFor={`req-${field.name}`} className="text-[9px] font-bold uppercase tracking-tight cursor-pointer">必填</label>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(index)}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Field Label */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">字段显示名称</label>
                    <Input
                        value={field.label}
                        onChange={(e) => {
                            const newLabel = e.target.value;
                            const updates: Partial<FormFieldConfig> = { label: newLabel };
                            // If name is still identifying as a default/generic one, sync it
                            if (field.name.startsWith('field_') || field.name === '') {
                                const slug = toVariableSlug(newLabel);
                                if (slug) {
                                    updates.name = `${slug}_${Date.now().toString().slice(-4)}`;
                                }
                            }
                            onUpdate(index, updates);
                        }}
                        placeholder="例如：姓名"
                        className={`${INPUT_CLASS} h-8 text-xs`}
                    />
                </div>

                {/* Field Type Selector */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">输入类型</label>
                    <Select
                        value={field.type}
                        onValueChange={(value: "select" | "text" | "multi-select") =>
                            onTypeChange(index, value)
                        }
                    >
                        <SelectTrigger className={`${INPUT_CLASS} h-8 text-xs`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="select">下拉单选</SelectItem>
                            <SelectItem value="multi-select">下拉多选</SelectItem>
                            <SelectItem value="text">纯文本</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Field Name - Variable Identity */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">变量标识 (ID)</label>
                    <span className="text-[9px] text-gray-400 italic">用于逻辑引用，建议仅用小写字母和下划线</span>
                </div>
                <Input
                    value={field.name}
                    onChange={(e) => onUpdate(index, { name: e.target.value })}
                    placeholder="field_name"
                    className={`${INPUT_CLASS} h-8 font-mono text-[11px] text-blue-600 bg-blue-50/20 border-blue-100 hover:border-blue-200 focus:border-blue-300 transition-colors`}
                />
            </div>

            {/* Type-specific fields */}
            {(field.type === "select" || field.type === "multi-select") && (
                <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200 pt-1 border-t border-gray-100 border-dashed">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">候选项 (中/英逗号分隔)</label>
                    <Input
                        value={(field as SelectFieldConfig | MultiSelectFieldConfig).options.join(", ")}
                        onChange={(e) =>
                            onUpdate(index, {
                                options: e.target.value.split(/[,,，，]/).map((s) => s.trim()).filter(Boolean),
                            })
                        }
                        placeholder="选项1, 选项2..."
                        className={`${INPUT_CLASS} h-8 text-xs`}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * StructuredFormSection - 结构化表单配置区块
 */
export function StructuredFormSection({
    enabled,
    onToggle,
    formFields,
    onAddField,
    onDeleteField,
    onFieldUpdate,
    onFieldTypeChange,
    isHeaderHidden = false,
}: StructuredFormSectionProps) {
    if (!enabled && isHeaderHidden) return null;

    return (
        <div className="space-y-4">
            {!isHeaderHidden && (
                <div className="flex items-center justify-between">
                    <div className={SECTION_TITLE_CLASS}>
                        <Switch checked={enabled} onCheckedChange={onToggle} />
                        <span>结构化表单</span>
                    </div>
                </div>
            )}

            {enabled && (
                <div className="space-y-4">
                    <div className="space-y-3">
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
                        className="w-full h-9 border-dashed border-gray-300 hover:border-blue-300 hover:bg-blue-50/30 hover:text-blue-600 transition-all rounded-xl text-xs"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        添加表单字段
                    </Button>
                </div>
            )}
        </div>
    );
}
