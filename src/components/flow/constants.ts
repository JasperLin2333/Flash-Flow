/**
 * 画布组件共享常量
 * 
 * 提取自 CustomNode.tsx 和 ToolNode.tsx，避免重复定义
 */

// 统一 Handle 样式：包含 z-index 和扩展点击区域
export const HANDLE_STYLE = "w-2.5 h-2.5 !bg-white !border-[1.5px] !border-gray-400 transition-all duration-150 hover:scale-125 z-50 after:content-[''] after:absolute after:-inset-4 after:rounded-full";

// 节点元数据显示样式
export const METADATA_LABEL_STYLE = "text-xs text-gray-500 font-semibold";
export const METADATA_VALUE_STYLE = "text-xs text-gray-500";
