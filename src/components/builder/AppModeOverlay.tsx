"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/store/flowStore";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { nanoid } from "nanoid";
import FlowAppInterface from "@/components/apps/FlowAppInterface";
import { extractTextFromUpstream } from "@/store/executors/contextUtils";

// ============ Constants ============
const ANIMATION = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
} as const;

const DEFAULT_ASSISTANT_MSG = "Flow completed without output.";
const ERROR_MSG = "Error executing flow.";

// ============ Utilities ============
/**
 * 提取执行结果文本
 * 必须通过 output 节点才能输出结果
 * 使用 extractTextFromUpstream 正确过滤 Branch 元数据
 */
function extractExecutionOutput(
    flowContext: Record<string, any>,
    nodes: Array<{ id: string; type: string }>
): string {
    const outputNode = nodes.find((n) => n.type === "output");

    if (!outputNode) {
        return "请在工作流中添加 Output 节点以显示输出结果。";
    }

    const outData = flowContext[outputNode.id];
    if (!outData) {
        return DEFAULT_ASSISTANT_MSG;
    }

    // 使用 extractTextFromUpstream 正确过滤 Branch 节点元数据
    return extractTextFromUpstream(outData, true) || DEFAULT_ASSISTANT_MSG;
}

export default function AppModeOverlay() {
    const isAppMode = useFlowStore((s) => s.isAppMode);
    const setAppMode = useFlowStore((s) => s.setAppMode);
    const runFlow = useFlowStore((s) => s.runFlow);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const nodes = useFlowStore((s) => s.nodes);
    const executionStatus = useFlowStore((s) => s.executionStatus);
    const flowContext = useFlowStore((s) => s.flowContext);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const flowIconKind = useFlowStore((s) => s.flowIconKind);
    const flowIconName = useFlowStore((s) => s.flowIconName);
    const flowIconUrl = useFlowStore((s) => s.flowIconUrl);

    // Streaming state
    const streamingText = useFlowStore((s) => s.streamingText);
    const isStreaming = useFlowStore((s) => s.isStreaming);

    const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; files?: File[] }[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 会话 ID：用于 LLM 对话记忆功能
    // 每个对话保持同一个 sessionId，新建对话时重置
    const [sessionId, setSessionId] = useState(() => nanoid(10));

    // 新建对话：重置对话状态和会话 ID
    const handleNewConversation = useCallback(() => {
        // 如果正在执行中，中止 streaming
        if (isLoading) {
            useFlowStore.getState().abortStreaming();
            setIsLoading(false);
        }

        // 重置对话状态
        setMessages([]);
        setInput("");
        setSessionId(nanoid(10)); // 生成新的会话 ID
    }, [isLoading]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading, streamingText]);

    // 处理流程完成或错误
    useEffect(() => {
        if (executionStatus === "completed" && isLoading) {
            setIsLoading(false);
            const outputText = extractExecutionOutput(flowContext, nodes);
            setMessages((prev) => [...prev, { role: "assistant", content: outputText }]);
            // Clear streaming AFTER adding the message to prevent flash
            // Use setTimeout to ensure state updates are processed first
            setTimeout(() => {
                useFlowStore.getState().clearStreaming();
            }, 0);
        } else if (executionStatus === "error" && isLoading) {
            setIsLoading(false);
            setMessages((prev) => [...prev, { role: "assistant", content: ERROR_MSG }]);
            setTimeout(() => {
                useFlowStore.getState().clearStreaming();
            }, 0);
        }
    }, [executionStatus, flowContext, nodes, isLoading]);

    const handleSend = async (files?: File[]) => {
        // 获取 Input 节点配置
        const inputNode = nodes.find((n) => n.type === "input");
        const inputNodeData = inputNode?.data as import("@/types/flow").InputNodeData | undefined;
        const enableTextInput = inputNodeData?.enableTextInput !== false;

        // 检查是否有内容可发送
        const hasText = input.trim().length > 0;
        const hasFiles = files && files.length > 0;
        const hasFormData = inputNodeData?.enableStructuredForm && inputNodeData?.formFields?.length;

        // 如果启用文本输入但没有任何内容，不发送
        if (enableTextInput && !hasText && !hasFiles) return;
        // 如果禁用文本输入，但既没有文件也没有表单，不发送
        if (!enableTextInput && !hasFiles && !hasFormData) return;
        if (isLoading) return;

        // 构建用户消息（支持空文本时显示友好提示）
        const userMsg = hasText
            ? input
            : hasFiles
                ? `📎 已上传 ${files.length} 个文件`
                : "📋 已通过表单提交信息";

        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMsg, files }]);
        setIsLoading(true);

        // 更新 Input Node并运行 Flow（传递 sessionId 用于记忆功能）
        if (inputNode) {
            updateNodeData(inputNode.id, { text: input }); // 仍然存储原始文本（可能为空）
        }
        await runFlow(sessionId);
    };


    // Compute display messages: append streaming text as partial assistant message
    const displayMessages = useMemo(() => {
        if (isStreaming && streamingText && isLoading) {
            return [...messages, { role: "assistant" as const, content: streamingText }];
        }
        return messages;
    }, [messages, isStreaming, streamingText, isLoading]);

    return (
        <AnimatePresence>
            {isAppMode && (
                <motion.div
                    initial={ANIMATION.initial}
                    animate={ANIMATION.animate}
                    exit={ANIMATION.exit}
                    className="fixed inset-0 z-50 bg-white flex flex-col"
                >
                    <FlowAppInterface
                        flowTitle={flowTitle}
                        flowIcon={{
                            kind: flowIconKind,
                            name: flowIconName,
                            url: flowIconUrl,
                        }}
                        messages={displayMessages}
                        isLoading={isLoading && !isStreaming}
                        input={input}
                        onInputChange={setInput}
                        onSend={handleSend}
                        onClose={() => setAppMode(false)}
                        onNewConversation={handleNewConversation}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

