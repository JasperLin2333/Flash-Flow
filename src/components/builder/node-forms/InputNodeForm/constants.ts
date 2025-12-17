import type { FormFieldConfig, SelectFieldConfig, TextFieldConfig, FileInputConfig, MultiSelectFieldConfig, InputNodeData } from "@/types/flow";

// ============ Style Constants ============
export const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
export const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";
export const SECTION_TITLE_CLASS = "text-xs font-semibold text-gray-700 flex items-center gap-2";

// ============ File Type Options ============
export const FILE_TYPE_OPTIONS = [
    { value: ".png,.jpg,.jpeg", label: "图片 (png, jpg)" },
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
    maxSizeMB: 100, // Customizable, default 100MB
    maxCount: 10, // Default to 10 files
};

// ============ Types ============
// Note: form uses 'any' for consistency with other node forms that share a common form schema
export interface InputNodeFormProps {
    form: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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
}

export interface StructuredFormSectionProps {
    enabled: boolean;
    onToggle: (checked: boolean) => void;
    formFields: FormFieldConfig[];
    onAddField: () => void;
    onDeleteField: (index: number) => void;
    onFieldUpdate: (index: number, updates: Partial<FormFieldConfig>) => void;
    onFieldTypeChange: (index: number, newType: "select" | "text" | "multi-select") => void;
}

// ============ Helper Functions ============
export function createNewTextField(): TextFieldConfig {
    return {
        type: "text",
        name: `field_${Date.now()}`,
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
            placeholder: "请输入...",
            required: currentField.required,
            defaultValue: "",
        } as TextFieldConfig;
    }
}
