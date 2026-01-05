import type { InputNodeData, FormFieldConfig } from "@/types/flow";

/**
 * 检查 Input 节点的必填字段是否缺失
 * 
 * @param data - Input 节点数据
 * @returns 是否有必填字段缺失
 */
export function checkInputNodeMissing(data: InputNodeData): boolean {
    // 检查结构化表单必填项
    const isFormEnabled = data.enableStructuredForm === true && Array.isArray(data.formFields);

    if (isFormEnabled && data.formFields) {
        return data.formFields.some((field: FormFieldConfig) => {
            if (!field.required) return false;
            const value = data.formData?.[field.name];
            return isFieldEmpty(value);
        });
    }

    return false;
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
