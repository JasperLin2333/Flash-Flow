import type { InputNodeData, FormFieldConfig } from "@/types/flow";

/**
 * 检查 Input 节点的必填字段是否缺失
 * 
 * @param data - Input 节点数据
 * @returns 是否有必填字段缺失
 */
export function checkInputNodeMissing(data: InputNodeData): boolean {
    const enableTextInput = data.enableTextInput !== false;
    const isTextMissing =
        enableTextInput &&
        data.textRequired === true &&
        isFieldEmpty(data.text);

    // 检查文件上传必填
    const isFileMissing =
        data.enableFileInput === true &&
        data.fileRequired === true &&
        (!Array.isArray(data.files) || data.files.length === 0);

    // 检查结构化表单必填项
    const isFormEnabled = data.enableStructuredForm === true && Array.isArray(data.formFields);

    const isFormMissing =
        isFormEnabled && data.formFields
            ? data.formFields.some((field: FormFieldConfig) => {
            if (!field.required) return false;
            const value = data.formData?.[field.name];
            if (!isFieldEmpty(value)) return false;
            const defaultValue = (field as any).defaultValue as unknown;
            if (defaultValue !== undefined && !isFieldEmpty(defaultValue)) return false;
            return true;
        })
            : false;

    return isTextMissing || isFileMissing || isFormMissing;
}


/**
 * 检查表单字段值是否为空
 * 
 * @param value - 字段值
 * @returns 是否为空
 */
export function isFieldEmpty(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    // 数字 0 视为有效值
    if (typeof value === 'number') return false;
    return false;
}
