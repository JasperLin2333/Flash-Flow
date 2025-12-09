import { Bot, Settings } from "lucide-react";
import type { InputNodeData } from "@/types/flow";
import { AppIcon } from "./AppIcon";
import { MessageBubble } from "./MessageBubble";
import { LAYOUT, STYLES, ANIMATION, UI_TEXT, type FlowIconConfig, type Message } from "./constants";
import { useAutoScroll } from "@/hooks/useAutoScroll";

// ============ EmptyState ============
interface EmptyStateProps {
    inputNodeData?: InputNodeData;
}

/**
 * EmptyState - 空状态提示
 * 当没有对话历史时显示，支持动态提示必填字段
 */
function EmptyState({ inputNodeData }: EmptyStateProps) {
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
                {messages.length === 0 && <EmptyState inputNodeData={inputNodeData} />}
                {messages.map((msg, idx) => (
                    <MessageBubble key={idx} role={msg.role} content={msg.content} files={msg.files} flowIcon={flowIcon} timestamp={msg.timestamp} />
                ))}
                {isLoading && <LoadingIndicator flowIcon={flowIcon} />}
            </div>
        </div>
    );
}
