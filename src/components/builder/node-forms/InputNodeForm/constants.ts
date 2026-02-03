import type { FormFieldConfig, SelectFieldConfig, TextFieldConfig, FileInputConfig, MultiSelectFieldConfig, InputNodeData } from "@/types/flow";
import { NODE_FORM_STYLES } from "../shared";

// ============ Style Constants (从共享模块导入) ============
export const LABEL_CLASS = NODE_FORM_STYLES.LABEL;
export const INPUT_CLASS = NODE_FORM_STYLES.INPUT;
export const SECTION_TITLE_CLASS = NODE_FORM_STYLES.SECTION_TITLE;

// ============ File Type Options ============
export const FILE_TYPE_OPTIONS = [
    { value: ".png,.jpg,.jpeg,.webp", label: "图片 (png, jpg, jpeg, webp)" },
    { value: ".pdf", label: "PDF (pdf)" },
    { value: ".doc,.docx", label: "Word 文档 (doc, docx)" },
    { value: ".xls,.xlsx", label: "Excel 表格 (xls, xlsx)" },
    { value: ".txt", label: "文本文件 (txt)" },
    { value: ".md", label: "Markdown (md)" },
    { value: ".csv", label: "CSV (csv)" },
] as const;

// ============ Default Values ============
export const DEFAULT_FILE_CONFIG: FileInputConfig = {
    allowedTypes: ["*/*"], // All files by default
    maxSizeMB: 100, // Maximum 100MB
    maxCount: 10, // Maximum 10 files
};

// ============ Types ============
// Note: form uses 'any' for consistency with other node forms that share a common form schema
export interface InputNodeFormProps {
    form: any;
    selectedNodeId?: string;
    updateNodeData?: (id: string, data: Partial<InputNodeData>) => void;
}

export interface FieldEditorProps {
    field: FormFieldConfig;
    index: number;
    onUpdate: (index: number, updates: Partial<FormFieldConfig>) => void;
    onDelete: (index: number) => void;
    onTypeChange: (index: number, newType: "select" | "text" | "multi-select") => void;
}

export interface FileInputSectionProps {
    enabled: boolean;
    onToggle: (checked: boolean) => void;
    fileConfig: FileInputConfig;
    onConfigChange: (updates: Partial<FileInputConfig>) => void;
    isHeaderHidden?: boolean;
}

export interface StructuredFormSectionProps {
    enabled: boolean;
    onToggle: (checked: boolean) => void;
    formFields: FormFieldConfig[];
    onAddField: () => void;
    onDeleteField: (index: number) => void;
    onFieldUpdate: (index: number, updates: Partial<FormFieldConfig>) => void;
    onFieldTypeChange: (index: number, newType: "select" | "text" | "multi-select") => void;
    isHeaderHidden?: boolean;
}

// ============ Helper Functions ============
// Bug 6 Fix: 生成更唯一的 name，确保 React key 从一开始就稳定
export function createNewTextField(): TextFieldConfig {
    const uniqueId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return {
        type: "text",
        name: uniqueId,
        label: "新字段",
        required: false,
    };
}

export function createFieldOfType(
    currentField: FormFieldConfig,
    newType: "select" | "text" | "multi-select"
): FormFieldConfig {
    if (newType === "select") {
        return {
            type: "select",
            name: currentField.name,
            label: currentField.label,
            options: ["选项1", "选项2"],
            required: currentField.required,
            defaultValue: "选项1",
        } as SelectFieldConfig;
    } else if (newType === "multi-select") {
        return {
            type: "multi-select",
            name: currentField.name,
            label: currentField.label,
            options: ["选项1", "选项2"],
            required: currentField.required,
            defaultValue: [],
        } as MultiSelectFieldConfig;
    } else {
        return {
            type: "text",
            name: currentField.name,
            label: currentField.label,
            placeholder: "请输入…",
            required: currentField.required,
            defaultValue: "",
        } as TextFieldConfig;
    }
}
