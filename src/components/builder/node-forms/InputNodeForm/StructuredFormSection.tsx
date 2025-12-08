"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { FormFieldConfig, SelectFieldConfig, MultiSelectFieldConfig } from "@/types/flow";
import { INPUT_CLASS, SECTION_TITLE_CLASS, type StructuredFormSectionProps } from "./constants";

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
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">字段 {index + 1}</span>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(index)}
                    className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>

            {/* Field Type Selector */}
            <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500">字段类型</label>
                <Select
                    value={field.type}
                    onValueChange={(value: "select" | "text" | "multi-select") =>
                        onTypeChange(index, value)
                    }
                >
                    <SelectTrigger className={`${INPUT_CLASS} h-8`}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="select">下拉单选</SelectItem>
                        <SelectItem value="multi-select">下拉多选</SelectItem>
                        <SelectItem value="text">文本字段</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Field Name - Editable variable name */}
            <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500">变量名</label>
                <Input
                    value={field.name}
                    onChange={(e) => onUpdate(index, { name: e.target.value })}
                    placeholder="field_name"
                    className={`${INPUT_CLASS} h-8`}
                />
            </div>

            {/* Field Label */}
            <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500">显示标签</label>
                <Input
                    value={field.label}
                    onChange={(e) => onUpdate(index, { label: e.target.value })}
                    placeholder="字段标签"
                    className={`${INPUT_CLASS} h-8`}
                />
            </div>

            {/* Type-specific fields */}
            {(field.type === "select" || field.type === "multi-select") && (
                <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-500">选项 (逗号分隔)</label>
                    <Input
                        value={(field as SelectFieldConfig | MultiSelectFieldConfig).options.join(", ")}
                        onChange={(e) =>
                            onUpdate(index, {
                                options: e.target.value.split(",").map((s) => s.trim()),
                            })
                        }
                        placeholder="选项1, 选项2, 选项3"
                        className={`${INPUT_CLASS} h-8`}
                    />
                </div>
            )}

            {/* Required Checkbox */}
            <div className="flex items-center gap-2">
                <Switch
                    checked={field.required}
                    onCheckedChange={(checked) => onUpdate(index, { required: checked })}
                />
                <label className="text-xs font-medium text-gray-600">必填</label>
            </div>
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
}: StructuredFormSectionProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className={SECTION_TITLE_CLASS}>
                    <Switch checked={enabled} onCheckedChange={onToggle} />
                    <span>结构化表单</span>
                </div>
            </div>

            {enabled && (
                <div className="pl-7 space-y-3 border-l-2 border-gray-200">
                    {formFields.map((field, index) => (
                        <FieldEditor
                            key={index}
                            field={field}
                            index={index}
                            onUpdate={onFieldUpdate}
                            onDelete={onDeleteField}
                            onTypeChange={onFieldTypeChange}
                        />
                    ))}

                    {/* Add Field Button - CRITICAL: type="button" to prevent form submission */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onAddField}
                        className="w-full border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        添加字段
                    </Button>
                </div>
            )}
        </div>
    );
}
