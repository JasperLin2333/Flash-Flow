import { Button } from "@/components/ui/button";
import PromptBubble from "@/components/ui/prompt-bubble";
import { Bot, User, X, Zap, Globe, FileText, Link as LinkIcon, Home, Plus, File as FileIcon, Image as ImageIcon, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/store/flowStore";
import type { InputNodeData } from "@/types/flow";

// ============ Constants ============
const ICON_MAP = {
    zap: Zap,
    globe: Globe,
    doc: FileText,
    link: LinkIcon,
} as const;

const BUTTON_STYLES = {
    newConversation: "h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 active:bg-gray-100 text-sm font-medium text-gray-700 transition-all duration-150",
} as const;

const DEFAULT_ICON = Bot;

const LAYOUT = {
    headerHeight: "h-16",
    maxWidth: "max-w-3xl",
    spacing: {
        header: "px-6",
        chat: "p-6",
        input: "p-6",
    },
} as const;

const STYLES = {
    header: "border-b border-gray-100 sticky top-0 z-10 bg-white",
    chat: "flex-1 overflow-y-auto bg-gray-50",
    messageBubble: "px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-150",
    avatar: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
    iconSize: "w-8 h-8",
} as const;

const ANIMATION = {
    loadingDots: [0, 150, 300],
} as const;

const UI_TEXT = {
    emptyState: "我是您的智能助手，请告诉我您的需求。",
    appTitle: "智能助手",
    inputPlaceholder: "搜索、提问或者说明你的需求...（请不要忘记在下方”设置“按钮填写表单内容哦~）",
    homeButton: "首页",
    closeButton: "关闭",
} as const;

export interface Message {
    role: "user" | "assistant";
    content: string;
    files?: File[];
}

interface FlowAppInterfaceProps {
    flowTitle: string;
    flowIcon?: {
        kind?: "emoji" | "lucide" | "image";
        name?: string;
        url?: string;
    };
    messages: Message[];
    isLoading: boolean;
    input: string;
    onInputChange: (value: string) => void;
    onSend: (files?: File[]) => void;
    onClose?: () => void;
    onGoHome?: () => void;
    onNewConversation?: () => void;
    /** Sidebar offset in pixels when sidebar is open */
    sidebarOffset?: number;
}

/**
 * AppIcon - 应用图标组件
 * 支持多种图标类型：image, lucide, emoji
 */
function AppIcon({ flowIcon, className }: { flowIcon?: FlowAppInterfaceProps["flowIcon"]; className?: string }) {
    if (flowIcon?.kind === "image" && flowIcon.url) {
        return (
            <img
                src={flowIcon.url}
                alt="flow icon"
                className={cn(STYLES.iconSize, "rounded-full object-cover", className)}
            />
        );
    }

    if (flowIcon?.kind === "lucide" && flowIcon.name) {
        const Icon = ICON_MAP[flowIcon.name as keyof typeof ICON_MAP] || DEFAULT_ICON;
        return (
            <div className={cn(STYLES.iconSize, "rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700", className)}>
                <Icon className={cn(STYLES.iconSize, "p-1.5", className)} />
            </div>
        );
    }

    if (flowIcon?.kind === "emoji" && flowIcon.name) {
        return (
            <div className={cn(STYLES.iconSize, "rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-base", className)}>
                {flowIcon.name}
            </div>
        );
    }

    return (
        <div className={cn(STYLES.iconSize, "rounded-full bg-black flex items-center justify-center text-white", className)}>
            <Bot className={cn(STYLES.iconSize, "p-1.5", className)} />
        </div>
    );
}

/**
 * Header - 头部导航区
 * 显示应用标题、图标、关闭按钮
 */
function Header({
    flowTitle,
    flowIcon,
    onClose,
    onGoHome,
    onNewConversation,
}: {
    flowTitle: string;
    flowIcon?: FlowAppInterfaceProps["flowIcon"];
    onClose?: () => void;
    onGoHome?: () => void;
    onNewConversation?: () => void;
}) {
    return (
        <header className={`${LAYOUT.headerHeight} ${LAYOUT.spacing.header} ${STYLES.header} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
                <AppIcon flowIcon={flowIcon} />
                <h1 className="font-bold text-sm text-gray-900">{flowTitle || UI_TEXT.appTitle}</h1>
                {onNewConversation && (
                    <button
                        onClick={onNewConversation}
                        className={BUTTON_STYLES.newConversation}
                        aria-label="新建对话"
                    >
                        <Plus className="w-4 h-4 inline mr-1" />
                        新建对话
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                {onGoHome && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onGoHome}
                        className="gap-1.5 text-gray-500 hover:text-gray-900"
                    >
                        <Home className="w-4 h-4" />
                        {UI_TEXT.homeButton}
                    </Button>
                )}
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        aria-label={UI_TEXT.closeButton}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                )}
            </div>
        </header>
    );
}

/**
 * EmptyState - 空状态提示
 * 当没有对话历史时显示，支持动态提示必填字段
 */
function EmptyState({ inputNodeData }: { inputNodeData?: InputNodeData }) {
    const formFields = inputNodeData?.formFields || [];
    const requiredFields = formFields.filter(f => f.required);
    const enableStructuredForm = inputNodeData?.enableStructuredForm === true;

    // 如果启用了结构化表单并有必填字段，显示动态提示
    if (enableStructuredForm && requiredFields.length > 0) {
        const fieldNames = requiredFields.map(f => f.label).join('、');
        return (
            <div className="text-center text-gray-400 mt-20 max-w-md mx-auto">
                <div className="w-12 h-12 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                    <Settings className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-gray-500 leading-relaxed">
                    请先点击 <span className="text-blue-500 font-medium">配置参数</span> 按钮，
                    填写 <span className="font-medium text-gray-700">{fieldNames}</span> 后发送。
                </p>
            </div>
        );
    }

    return (
        <div className="text-center text-gray-400 mt-20">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-gray-500">{UI_TEXT.emptyState}</p>
        </div>
    );
}

// File type icon helper
const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return ImageIcon;
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) return FileText;
    return FileIcon;
};

/**
 * MessageBubble - 消息气泡组件
 * 支持用户和助手两种角色
 */
function MessageBubble({ role, content, files, flowIcon }: { role: "user" | "assistant"; content: string; files?: File[]; flowIcon?: FlowAppInterfaceProps["flowIcon"] }) {
    const isUser = role === "user";
    const bubbleStyle = isUser
        ? "bg-blue-600 text-white border border-blue-600"
        : "bg-white text-gray-900 border border-gray-200";

    return (
        <div className={`flex gap-3 items-start ${isUser ? "flex-row-reverse" : ""}`}>
            <div className={`${STYLES.avatar} ${isUser ? "bg-gray-200" : ""}`}>
                {isUser ? (
                    <User className="w-5 h-5 text-gray-600" />
                ) : (
                    <AppIcon flowIcon={flowIcon} className="w-8 h-8" />
                )}
            </div>
            <div className="flex flex-col gap-2 max-w-[80%]">
                <div className={`${STYLES.messageBubble} ${bubbleStyle} w-fit ${isUser ? "ml-auto" : ""}`}>
                    <div className="whitespace-pre-wrap">{content}</div>
                </div>
                {files && files.length > 0 && (
                    <div className={`flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pb-1 max-w-full ${isUser ? "justify-end" : "justify-start"}`}>
                        {files.map((file, i) => {
                            const Icon = getFileIcon(file.name);
                            return (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 min-w-[160px] max-w-[200px] shrink-0">
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-blue-500 shrink-0">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-700 truncate" title={file.name}>{file.name}</p>
                                        <p className="text-[10px] text-gray-400 truncate">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * LoadingIndicator - 加载动画
 * 显示三个跳动的圆点，表示AI正在思考
 */
function LoadingIndicator({ flowIcon }: { flowIcon?: FlowAppInterfaceProps["flowIcon"] }) {
    return (
        <div className="flex gap-3 items-start">
            <div className={STYLES.avatar}>
                <AppIcon flowIcon={flowIcon} className="w-8 h-8" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-2">
                {ANIMATION.loadingDots.map((delay, i) => (
                    <div
                        key={i}
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * ChatArea - 聊天区域
 * 显示消息列表、空状态、加载动画
 */
function ChatArea({
    messages,
    isLoading,
    flowIcon,
    inputNodeData,
}: {
    messages: Message[];
    isLoading: boolean;
    flowIcon?: FlowAppInterfaceProps["flowIcon"];
    inputNodeData?: InputNodeData;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    return (
        <div
            className={`${LAYOUT.spacing.chat} ${STYLES.chat}`}
            ref={scrollRef}
            role="log"
            aria-live="polite"
        >
            <div className={`${LAYOUT.maxWidth} mx-auto space-y-6`}>
                {messages.length === 0 && <EmptyState inputNodeData={inputNodeData} />}
                {messages.map((msg, idx) => (
                    <MessageBubble key={idx} role={msg.role} content={msg.content} files={msg.files} flowIcon={flowIcon} />
                ))}
                {isLoading && <LoadingIndicator flowIcon={flowIcon} />}
            </div>
        </div>
    );
}

/**
 * FlowAppInterface - 主应用界面
 * 提供完整的聊天交互体验
 */
export default function FlowAppInterface({
    flowTitle,
    flowIcon,
    messages,
    isLoading,
    input,
    onInputChange,
    onSend,
    onClose,
    onGoHome,
    onNewConversation,
    sidebarOffset = 0,
}: FlowAppInterfaceProps) {
    const nodes = useFlowStore((s) => s.nodes);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [formData, setFormData] = useState<Record<string, unknown>>({});

    // Find Input node to get configuration
    const inputNode = nodes.find(n => n.type === "input");
    const inputNodeData = inputNode?.data as InputNodeData | undefined;

    // Handle send with files and form data
    const handleSend = () => {
        if (inputNode) {
            // Update Input node with files and form data before sending
            updateNodeData(inputNode.id, {
                text: input,
                // In a real implementation, we would upload files here and pass URLs
            });
        }

        onSend(selectedFiles);
        setSelectedFiles([]);
    };

    // Handle file selection (append)
    const handleFileSelect = (newFiles: File[]) => {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
    };

    // Handle file removal
    const handleFileRemove = (fileToRemove: File) => {
        setSelectedFiles((prev) => prev.filter((f) => f !== fileToRemove));
    };

    return (
        <div className="flex flex-col flex-1 w-full h-full bg-white">
            <Header flowTitle={flowTitle} flowIcon={flowIcon} onClose={onClose} onGoHome={onGoHome} onNewConversation={onNewConversation} />
            <div
                className="flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-out"
                style={{ marginLeft: sidebarOffset }}
            >
                <ChatArea messages={messages} isLoading={isLoading} flowIcon={flowIcon} inputNodeData={inputNodeData} />
                <div className={`${LAYOUT.spacing.input} bg-gray-50`}>
                    <div className={`${LAYOUT.maxWidth} mx-auto`}>
                        <PromptBubble
                            value={input}
                            onChange={onInputChange}
                            onSubmit={handleSend}
                            placeholder={UI_TEXT.inputPlaceholder}
                            disabled={isLoading}
                            minRows={1}
                            inputNodeData={inputNodeData}
                            selectedFiles={selectedFiles}
                            onFileSelect={handleFileSelect}
                            onFileRemove={handleFileRemove}
                            onFormDataChange={setFormData}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

