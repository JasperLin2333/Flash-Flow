import type { FormFieldConfig } from "@/types/flow";

/**
 * 将结构化表单数据格式化为用户消息
 * 格式：
 * Label 1: Value 1
 * Label 2: Value 2
 */
export function formatFormMessage(
    formFields: FormFieldConfig[] | undefined,
    formData: Record<string, unknown> | undefined
): string {
    if (!formFields || !formData || formFields.length === 0) {
        return "📋 已通过表单提交信息";
    }

    const lines = formFields
        .map(field => {
            const value = formData[field.name];

            // 跳过未填写或为空的值（根据需求，也可以显示为"未填写"）
            if (value === undefined || value === null || value === "") {
                return null;
            }

            let displayValue: string;

            if (Array.isArray(value)) {
                displayValue = value.join(", ");
            } else {
                displayValue = String(value);
            }

            return `${field.label}: ${displayValue}`;
        })
        .filter((line): line is string => line !== null);

    if (lines.length === 0) {
        return "📋 已通过表单提交信息";
    }

    return lines.join("\n");
}
