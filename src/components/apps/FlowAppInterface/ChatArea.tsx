import { Bot, BookOpen } from "lucide-react";
import type { InputNodeData } from "@/types/flow";
import { AppIcon } from "./AppIcon";
import { MessageBubble } from "./MessageBubble";
import { LAYOUT, STYLES, ANIMATION, UI_TEXT, type FlowIconConfig, type Message } from "./constants";
import { useAutoScroll } from "@/hooks/useAutoScroll";

// ============ EmptyState ============
interface EmptyStateProps {
    inputNodeData?: InputNodeData;
    flowTitle?: string;
}

/**
 * EmptyState - 空状态提示
 * 当没有对话历史时显示，支持动态提示必填字段
 */
function EmptyState({ inputNodeData, flowTitle }: EmptyStateProps) {
    const enableStructuredForm = inputNodeData?.enableStructuredForm === true;
    const formFields = inputNodeData?.formFields || [];
    const requiredFields = enableStructuredForm ? formFields.filter(f => f.required) : [];
    const appName = flowTitle || "智能助手";

    // 如果启用了结构化表单并有必填字段，显示动态提示
    if (enableStructuredForm && requiredFields.length > 0) {
        const fieldNames = requiredFields.map(f => f.label);
        return (
            <div className="text-center text-gray-400 mt-16 max-w-lg mx-auto px-4">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                    <BookOpen className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                    欢迎使用「{appName}」
                </h3>
                <p className="text-gray-500 leading-relaxed mb-4">
                    为了获得更好的体验，请先点击左下角的
                    <span className="inline-flex items-center mx-1 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-md font-medium text-sm">
                        <BookOpen className="w-3.5 h-3.5 mr-1" />
                        填写表单
                    </span>
                    按钮，填写以下信息：
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {fieldNames.map((name, i) => (
                        <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-medium shadow-sm">
                            {name}
                        </span>
                    ))}
                </div>
                <p className="text-gray-400 text-sm">
                    ✨ 填写完成后即可开始对话
                </p>
            </div>
        );
    }

    // 普通欢迎界面
    return (
        <div className="text-center text-gray-400 mt-16 max-w-lg mx-auto px-4">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center">
                <Bot className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
                欢迎使用「{appName}」
            </h3>
            <p className="text-gray-500">{UI_TEXT.emptyState}</p>
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
}

/**
 * ChatArea - 聊天区域
 * 显示消息列表、空状态、加载动画
 */
export function ChatArea({
    messages,
    isLoading,
    flowIcon,
    inputNodeData,
    flowTitle,
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
            <div className={`${LAYOUT.maxWidth} mx-auto space-y-12`}>
                {messages.length === 0 && <EmptyState inputNodeData={inputNodeData} flowTitle={flowTitle} />}
                {messages.map((msg, idx) => (
                    <MessageBubble key={idx} role={msg.role} content={msg.content} files={msg.files} attachments={msg.attachments} flowIcon={flowIcon} timestamp={msg.timestamp} />
                ))}
                {isLoading && <LoadingIndicator flowIcon={flowIcon} />}
            </div>
        </div>
    );
}
