import { Bot, Zap, Globe, FileText, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============ Constants ============
export const ICON_MAP = {
    zap: Zap,
    globe: Globe,
    doc: FileText,
    link: LinkIcon,
} as const;

export const BUTTON_STYLES = {
    newConversation: "h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 active:bg-gray-100 text-sm font-medium text-gray-700 transition-all duration-150",
} as const;

export const DEFAULT_ICON = Bot;

export const LAYOUT = {
    headerHeight: "h-16",
    maxWidth: "max-w-5xl",  // 聊天区域
    inputMaxWidth: "max-w-3xl",  // 输入框区域
    spacing: {
        header: "px-6",
        chat: "p-6",
        input: "p-6",
    },
} as const;

export const STYLES = {
    header: "border-b border-gray-100 sticky top-0 z-10 bg-white",
    chat: "flex-1 overflow-y-auto bg-gray-50",
    messageBubble: "px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-150",
    avatar: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
    iconSize: "w-8 h-8",
} as const;

export const ANIMATION = {
    loadingDots: [0, 150, 300],
} as const;

export const UI_TEXT = {
    emptyState: "我是您的智能助手，请告诉我您的需求。",
    appTitle: "智能助手",
    inputPlaceholder: "搜索、提问或者说明你的需求...（请不要忘记在下方'设置'按钮填写表单内容哦~）",
    homeButton: "首页",
    closeButton: "关闭",
} as const;

// ============ Types ============
import { type ChatMessage, type ChatAttachment } from "@/types/chat";

export interface FlowIconConfig {
    kind?: "emoji" | "lucide" | "image";
    name?: string;
    url?: string;
}

export type Message = ChatMessage;
export type Attachment = ChatAttachment;

export interface FlowAppInterfaceProps {
    flowTitle: string;
    flowIcon?: FlowIconConfig;
    messages: Message[];
    isLoading: boolean;
    isStreaming?: boolean; // 新增：标识是否正在流式输出
    input: string;
    onInputChange: (value: string) => void;
    onSend: (files?: File[]) => void;
    onClose?: () => void;
    onGoHome?: () => void;
    onNewConversation?: () => void;
    /** Sidebar offset in pixels when sidebar is open */
    sidebarOffset?: number;
}

// ============ Helpers ============
import { File as FileIcon, Image as ImageIcon } from "lucide-react";

/**
 * Get file icon based on file extension
 */
export function getFileIcon(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return ImageIcon;
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) return FileText;
    return FileIcon;
}
