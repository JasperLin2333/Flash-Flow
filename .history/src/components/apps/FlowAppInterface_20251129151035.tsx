import { Button } from "@/components/ui/button";
import PromptBubble from "@/components/ui/prompt-bubble";
import { Bot, User, X, Zap, Globe, FileText, Link as LinkIcon, Home } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ============ Constants ============
const ICON_MAP = {
    zap: Zap,
    globe: Globe,
    doc: FileText,
    link: LinkIcon,
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
    messageBubble: "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-150",
    avatar: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
    iconSize: "w-8 h-8",
} as const;

const ANIMATION = {
    loadingDots: [0, 150, 300],
} as const;

interface FlowAppInterfaceProps {
    flowTitle: string;
    flowIcon?: {
        kind?: "emoji" | "lucide" | "image";
        name?: string;
        url?: string;
    };
    messages: { role: "user" | "assistant"; content: string }[];
    isLoading: boolean;
    input: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
    onClose?: () => void;
    onGoHome?: () => void;
}

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

function Header({
    flowTitle,
    flowIcon,
    onClose,
    onGoHome,
}: {
    flowTitle: string;
    flowIcon?: FlowAppInterfaceProps["flowIcon"];
    onClose?: () => void;
    onGoHome?: () => void;
}) {
    return (
        <header className={`${LAYOUT.headerHeight} ${LAYOUT.spacing.header} ${STYLES.header} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
                <AppIcon flowIcon={flowIcon} />
                <h1 className="font-bold text-sm text-gray-900">{flowTitle || "智能助手"}</h1>
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
                        首页
                    </Button>
                )}
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        aria-label="关闭"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                )}
            </div>
        </header>
    );
}

function EmptyState() {
    return (
        <div className="text-center text-gray-400 mt-20">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-gray-500">我是您的智能助手，请告诉我您的需求。</p>
        </div>
    );
}

function MessageBubble({ role, content, flowIcon }: { role: "user" | "assistant"; content: string; flowIcon?: FlowAppInterfaceProps["flowIcon"] }) {
    const isUser = role === "user";
    const bubbleStyle = isUser
        ? "bg-white text-gray-900 border border-gray-200"
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
            <div className={`${STYLES.messageBubble} ${bubbleStyle}`}>
                <div className="whitespace-pre-wrap">{content}</div>
            </div>
        </div>
    );
}

function LoadingIndicator({ flowIcon }: { flowIcon?: FlowAppInterfaceProps["flowIcon"] }) {
    return (
        <div className="flex gap-3 items-start">
            <div className={STYLES.avatar}>
                <AppIcon flowIcon={flowIcon} className="w-8 h-8" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl border border-gray-200 flex items-center gap-2">
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

function ChatArea({
    messages,
    isLoading,
    flowIcon,
}: {
    messages: FlowAppInterfaceProps["messages"];
    isLoading: boolean;
    flowIcon?: FlowAppInterfaceProps["flowIcon"];
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
                {messages.length === 0 && <EmptyState />}
                {messages.map((msg, idx) => (
                    <MessageBubble key={idx} role={msg.role} content={msg.content} flowIcon={flowIcon} />
                ))}
                {isLoading && <LoadingIndicator flowIcon={flowIcon} />}
            </div>
        </div>
    );
}

function InputArea({
    input,
    onInputChange,
    onSend,
    isLoading,
}: {
    input: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
    isLoading: boolean;
}) {
    return (
        <div className={`${LAYOUT.spacing.input} bg-gray-50 border-t border-gray-100`}>
            <div className={`${LAYOUT.maxWidth} mx-auto`}>
                <PromptBubble
                    value={input}
                    onChange={onInputChange}
                    onSubmit={onSend}
                    placeholder="搜索、提问或者说明你的需求..."
                    disabled={isLoading}
                />
            </div>
        </div>
    );
}

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
}: FlowAppInterfaceProps) {
    return (
        <div className="flex flex-col flex-1 w-full h-full bg-white">
            <Header flowTitle={flowTitle} flowIcon={flowIcon} onClose={onClose} onGoHome={onGoHome} />
            <ChatArea messages={messages} isLoading={isLoading} flowIcon={flowIcon} />
            <InputArea input={input} onInputChange={onInputChange} onSend={onSend} isLoading={isLoading} />
        </div>
    );
}
