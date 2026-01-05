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
    /** Textarea 样式 */
    TEXTAREA: "min-h-[80px] font-mono text-xs bg-white border-gray-200 rounded-lg",
    /** 卡片容器样式 */
    CARD: "bg-gray-50/50 rounded-xl p-3 border border-gray-100",
    /** 卡片内部间距 */
    CARD_SPACING: "space-y-3",
    /** 帮助文本样式 */
    HELPER_TEXT: "text-[9px] text-gray-400",
    /** Slider 范围标签样式 */
    SLIDER_RANGE: "flex justify-between text-[9px] text-gray-400 mt-1",
    /** 添加按钮样式 */
    ADD_BUTTON: "w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-1",
    /** 图标按钮样式 */
    ICON_BUTTON: "p-1 hover:bg-gray-100 rounded-full transition-colors",
    /** 删除按钮样式 */
    REMOVE_BUTTON: "p-1 hover:bg-red-50 rounded-full text-gray-300 hover:text-red-500 transition-colors",
} as const;

// 为了向后兼容，也导出单独的常量
export const LABEL_CLASS = NODE_FORM_STYLES.LABEL;
export const INPUT_CLASS = NODE_FORM_STYLES.INPUT;
export const SECTION_TITLE_CLASS = NODE_FORM_STYLES.SECTION_TITLE;

