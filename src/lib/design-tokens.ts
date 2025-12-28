/**
 * Design Tokens - 统一设计规范
 * 用于保持 UI 组件的一致性
 */
export const DESIGN_TOKENS = {
    // ============ 圆角规范 ============
    radius: {
        /** 卡片/面板外层圆角 */
        card: '16px',        // rounded-2xl
        /** 卡片内嵌元素圆角（如 Footer） */
        cardInner: '12px',   // rounded-xl
        /** 输入框/按钮圆角 */
        input: '8px',        // rounded-lg
        /** 连接点 Handle */
        handle: '50%',       // rounded-full
    },

    // ============ 边框颜色规范 ============
    border: {
        /** 默认边框 */
        default: 'gray-200',
        /** 浅色分割线 */
        light: 'gray-100',
        /** 输入框边框 */
        input: 'gray-200',
        /** 选中状态边框 */
        selected: 'black',
        /** Handle 默认边框 */
        handle: 'gray-400',
    },

    // ============ 背景色规范 ============
    background: {
        /** 输入框背景 - 统一使用白色 */
        input: 'white',
        /** 输入框 Hover 状态 */
        inputHover: 'gray-50',
        /** 区块背景（如表单分区） */
        section: 'gray-50',
        /** 卡片背景 */
        card: 'white',
        /** 页脚/次要区域 */
        footer: 'gray-50',
    },

    // ============ 选中状态规范 ============
    selection: {
        /** 节点选中 ring */
        ring: 'ring-2 ring-black',
        /** 选中阴影 */
        shadow: 'shadow-lg',
        /** Handle 选中边框 */
        handleBorder: '!border-black',
    },

    // ============ 分割线规范 ============
    divider: {
        /** 表单内分割线 */
        form: 'border-t border-gray-100',
        /** 节点卡片分割线 */
        card: 'border-gray-200',
    },

    // ============ 字体规范 ============
    typography: {
        /** 表单标签 */
        label: 'text-[10px] font-bold uppercase tracking-wider text-gray-500',
        /** 节点标题 */
        nodeTitle: 'text-sm font-bold text-gray-900 tracking-tight',
        /** 元数据标签 */
        metaLabel: 'text-xs text-gray-500 font-semibold',
        /** 元数据值 */
        metaValue: 'text-xs text-gray-500',
        /** 配置面板输入框 */
        inputPanel: 'text-xs placeholder:text-xs placeholder:text-gray-400',
        /** 弹窗输入框 */
        inputDialog: 'text-sm placeholder:text-sm placeholder:text-gray-400',
        /** 代码/表达式输入框 */
        inputMono: 'font-mono text-xs placeholder:text-xs placeholder:text-gray-400',
    },

    // ============ 间距规范 ============
    spacing: {
        /** 节点 Header padding */
        nodeHeader: 'px-4 py-3.5',
        /** 节点 Body padding */
        nodeBody: 'p-4',
        /** 面板内容 padding */
        panel: 'p-5',
        /** 表单项间距 */
        formGap: 'space-y-4',
    },

    // ============ Handle 规范 ============
    handle: {
        /** 尺寸 */
        size: 'w-2.5 h-2.5',
        /** 基础样式 */
        base: '!bg-white !border-[1.5px] !border-gray-400',
        /** 交互样式 */
        interaction: 'transition-all duration-150 hover:scale-125',
        /** 层级 */
        zIndex: 'z-50',
        /** 扩展点击区域 */
        hitArea: "after:content-[''] after:absolute after:-inset-4 after:rounded-full",
    },
} as const;

// ============ Tailwind 类名常量 ============
// 方便直接在组件中使用

/** 统一输入框样式 - 白色背景 */
export const INPUT_STYLES = 'bg-white border-gray-200 text-gray-900';

/** 统一 Handle 样式 */
export const HANDLE_STYLES = `${DESIGN_TOKENS.handle.size} ${DESIGN_TOKENS.handle.base} ${DESIGN_TOKENS.handle.interaction} ${DESIGN_TOKENS.handle.zIndex} ${DESIGN_TOKENS.handle.hitArea}`;

/** 统一节点选中样式 */
export const NODE_SELECTED_STYLES = 'ring-2 ring-black border-transparent shadow-lg';

/** 统一节点 Hover 样式 */
export const NODE_HOVER_STYLES = 'hover:border-gray-300 hover:shadow-lg';

/** 统一分割线样式 */
export const DIVIDER_STYLES = 'border-t border-gray-100';
