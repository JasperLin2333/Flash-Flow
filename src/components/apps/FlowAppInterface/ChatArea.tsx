import type { InputNodeData } from "@/types/flow";
import { AppIcon } from "./AppIcon";
import { MessageBubble } from "./MessageBubble";
import { CentralForm } from "../../run/CentralForm";
import { LAYOUT, STYLES, ANIMATION, UI_TEXT, type FlowIconConfig, type Message } from "./constants";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { memo } from "react";

// ============ EmptyState ============
interface EmptyStateProps {
    inputNodeData?: InputNodeData;
    flowTitle?: string;
    onSend?: (data: { text: string; files?: File[]; formData?: Record<string, unknown> }) => void;
    onFormDataChange?: (formData: Record<string, unknown>) => void;
}

/**
 * EmptyState - 空状态提示
 * 当没有对话历史时显示，显示自定义招呼语 或 中央表单
 */
function EmptyState({ inputNodeData, flowTitle, onSend, onFormDataChange }: EmptyStateProps) {
    // Check if we should show the Central Form
    const showCentralForm = inputNodeData?.enableStructuredForm && onSend;

    if (showCentralForm) {
        return (
            <CentralForm
                inputNodeData={inputNodeData}
                flowTitle={flowTitle}
                onSend={onSend}
                onFormDataChange={onFormDataChange}
            />
        );
    }

    const appName = flowTitle || "智能助手";
    const greeting = inputNodeData?.greeting || UI_TEXT.emptyState;

    return (
        <div className="text-center text-gray-400 mt-32 max-w-lg mx-auto px-4">
            <h3 className="text-3xl font-bold text-gray-800 mb-3">
                你好，我是「{appName}」
            </h3>
            <p className="text-gray-500 leading-relaxed">{greeting}</p>
        </div>
    );
}


// ============ LoadingIndicator ============
interface LoadingIndicatorProps {
    flowIcon?: FlowIconConfig;
}

/**
 * LoadingIndicator - 加载动画
 * 显示三个跳动的圆点，表示AI正在思考
 */
function LoadingIndicator({ flowIcon }: LoadingIndicatorProps) {
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

// ============ ChatArea ============
interface ChatAreaProps {
    messages: Message[];
    isLoading: boolean;
    flowIcon?: FlowIconConfig;
    inputNodeData?: InputNodeData;
    flowTitle?: string;
    isStreaming?: boolean;
    streamingText?: string;
    streamingReasoning?: string;
    isStreamingReasoning?: boolean;
    // New props for Central Form
    onSend?: (data: { text: string; files?: File[]; formData?: Record<string, unknown> }) => void;
    onFormDataChange?: (formData: Record<string, unknown>) => void;
}

/**
 * ChatArea - 聊天区域
 * 显示消息列表、空状态、加载动画
 */
export const ChatArea = memo(function ChatArea({
    messages,
    isLoading,
    flowIcon,
    inputNodeData,
    flowTitle,
    isStreaming,
    streamingText,
    streamingReasoning,
    isStreamingReasoning,
    onSend,
    onFormDataChange,
}: ChatAreaProps) {
    // 使用智能自动滚动 hook：用户主动滚动时暂停，滚动回底部时恢复
    const { scrollRef } = useAutoScroll<HTMLDivElement>([messages, isLoading]);

    return (
        <div
            className={`${LAYOUT.spacing.chat} ${STYLES.chat}`}
            ref={scrollRef}
            role="log"
            aria-live="polite"
        >
            <div className={`${LAYOUT.maxWidth} mx-auto space-y-12 pb-24`}>
                {messages.length === 0 && (
                    <EmptyState
                        inputNodeData={inputNodeData}
                        flowTitle={flowTitle}
                        onSend={onSend}
                        onFormDataChange={onFormDataChange}
                    />
                )}
                {messages.map((msg, idx) => {
                    const isLast = idx === messages.length - 1;
                    return (
                        <MessageBubble
                            key={idx}
                            role={msg.role}
                            content={(isLast && isStreaming) ? (streamingText || msg.content) : msg.content}
                            reasoning={(isLast && (isStreaming || isStreamingReasoning)) ? (streamingReasoning || msg.reasoning) : msg.reasoning}
                            files={msg.files}
                            attachments={msg.attachments}
                            flowIcon={flowIcon}
                            timestamp={msg.timestamp}
                            isStreaming={isLast && isStreaming}
                            isStreamingReasoning={isLast && isStreamingReasoning}
                        />
                    );
                })}
                {isLoading && <LoadingIndicator flowIcon={flowIcon} />}
            </div>
        </div>
    );
});
