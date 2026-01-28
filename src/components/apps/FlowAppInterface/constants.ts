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
    emptyState: "你好，我是你的 AI 架构师，想打造什么样的工作流？",
    appTitle: "Flash Flow 智能体",
    inputPlaceholder: "描述您的需求，我来帮您实现...",
    homeButton: "返回首页",
    closeButton: "退出预览",
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
    isStreaming?: boolean;
    streamingText?: string; // 加入流式文本，以便实时显示
    streamingReasoning?: string; // 加入流式推理，以便实时显示
    isStreamingReasoning?: boolean; // 是否正在流式输出推理
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
