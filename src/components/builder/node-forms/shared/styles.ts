"use client";

/**
 * 节点表单共享样式常量
 * 所有节点表单统一使用这些样式类名 - 基于 "Refined" 风格优化
 */
export const NODE_FORM_STYLES = {
    /** 表单标签样式 - 更加清晰易读，去除非必要的全大写 */
    LABEL: "text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5",
    
    /** 输入框样式 - 更加现代、无框感强 */
    INPUT: "bg-gray-50/50 border-gray-200 text-gray-900 shadow-sm hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all h-9 text-xs rounded-lg px-3 placeholder:text-gray-400 font-medium",
    
    /** 分区标题样式 */
    SECTION_TITLE: "text-xs font-semibold text-gray-900 flex items-center gap-1.5 mb-2 select-none",
    
    /** 分隔线样式 */
    SECTION_DIVIDER: "border-t border-gray-100 my-4",
    
    /** 基础 Textarea 样式 */
    TEXTAREA: "min-h-[100px] font-mono text-xs leading-relaxed bg-gray-50/50 border-gray-200 rounded-lg shadow-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y p-3 placeholder:text-gray-400",
    
    /** 代码/Prompt 编辑器容器 - 模拟 IDE 风格 */
    EDITOR_WRAPPER: "relative rounded-xl border border-gray-200 bg-gray-50/50 focus-within:bg-white focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all overflow-hidden",
    
    /** 编辑器头部 */
    EDITOR_HEADER: "flex items-center justify-between px-3 py-2 bg-gray-100/50 border-b border-gray-200/50",
    
    /** 编辑器标签 */
    EDITOR_LABEL: "text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5",
    
    /** 编辑器输入区 */
    EDITOR_AREA: "min-h-[120px] font-mono text-xs leading-relaxed bg-transparent border-0 focus-visible:ring-0 p-3 resize-y placeholder:text-gray-400 w-full outline-none",

    /** 卡片容器样式 - 更干净的白底卡片 */
    CARD: "group relative bg-white rounded-xl p-1 border border-gray-200/80 shadow-sm hover:border-gray-300/80 hover:shadow transition-all duration-200 overflow-hidden",
    
    /** 卡片内部间距 */
    CARD_SPACING: "space-y-3",
    
    /** 帮助文本样式 */
    HELPER_TEXT: "text-[10px] text-gray-400 mt-1 leading-normal",
    
    /** Slider 范围标签样式 */
    SLIDER_RANGE: "flex justify-between text-[10px] text-gray-400 mt-1.5",
    
    /** Slider 标签样式 */
    SLIDER_LABEL: "text-xs font-medium text-gray-600",
    
    /** Slider 数值样式 */
    SLIDER_VALUE: "text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100",
    
    /** 添加按钮样式 */
    ADD_BUTTON: "w-full py-2 text-xs font-medium text-gray-500 hover:text-indigo-600 border border-dashed border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-[0.99]",
    
    /** 图标按钮样式 */
    ICON_BUTTON: "p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-lg transition-colors",
    
    /** 删除按钮样式 */
    REMOVE_BUTTON: "p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors",
    
    /** 验证/状态卡片 */
    VALIDATION_CARD: "mt-3 rounded-lg p-3 text-xs border transition-all duration-300",

    /** 变量引用输入框 (仿 Output 节点附件样式) - 更紧凑、白底 */
    VARIABLE_INPUT: "w-full h-8 text-xs px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono transition-all placeholder:text-gray-300 bg-white",
} as const;

// 为了向后兼容，也导出单独的常量
export const LABEL_CLASS = NODE_FORM_STYLES.LABEL;
export const INPUT_CLASS = NODE_FORM_STYLES.INPUT;
export const SECTION_TITLE_CLASS = NODE_FORM_STYLES.SECTION_TITLE;
