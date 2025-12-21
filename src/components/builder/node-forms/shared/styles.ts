"use client";

/**
 * 节点表单共享样式常量
 * 所有节点表单统一使用这些样式类名
 */
export const NODE_FORM_STYLES = {
    /** 表单标签样式 */
    LABEL: "text-[10px] font-bold uppercase tracking-wider text-gray-500",
    /** 输入框样式 */
    INPUT: "bg-gray-50 border-gray-200 text-gray-900",
    /** 分区标题样式 */
    SECTION_TITLE: "text-xs font-semibold text-gray-700 flex items-center gap-2",
} as const;

// 为了向后兼容，也导出单独的常量
export const LABEL_CLASS = NODE_FORM_STYLES.LABEL;
export const INPUT_CLASS = NODE_FORM_STYLES.INPUT;
export const SECTION_TITLE_CLASS = NODE_FORM_STYLES.SECTION_TITLE;
