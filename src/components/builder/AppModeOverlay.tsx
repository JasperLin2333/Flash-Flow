"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/store/flowStore";
import { useState, useEffect, useCallback, useMemo } from "react";
import { nanoid } from "nanoid";
import FlowAppInterface from "@/components/apps/FlowAppInterface";
import { extractOutputFromContext } from "@/store/executors/contextUtils";
import { fileUploadService } from "@/services/fileUploadService";
import type { FlowContext, AppNode } from "@/types/flow";
import type { ChatAttachment } from "@/types/chat";
import { showError } from "@/utils/errorNotify";

// ============ Constants ============
const ANIMATION = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
} as const;

const DEFAULT_ASSISTANT_MSG = "Flow completed without output.";
const ERROR_MSG = "执行过程中发生错误，请检查流程配置。";

// ============ Types ============
interface AppMessage {
    role: "user" | "assistant";
    content: string;
    files?: File[];
    attachments?: ChatAttachment[];
    timestamp?: Date;
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

    // Segment streaming state (for merge mode)
    const streamingMode = useFlowStore((s) => s.streamingMode);
    const streamingSegments = useFlowStore((s) => s.streamingSegments);

    const [messages, setMessages] = useState<AppMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

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

    // 处理流程完成或错误
    useEffect(() => {
        if (executionStatus === "completed" && isLoading) {
            setIsLoading(false);
            // 使用 extractOutputFromContext 同时提取文本和附件
            const output = extractOutputFromContext(nodes as AppNode[], flowContext);
            setMessages((prev) => [...prev, {
                role: "assistant",
                content: output.text,
                attachments: output.attachments,
                timestamp: new Date()
            }]);
            // Clear streaming AFTER adding the message to prevent flash
            setTimeout(() => {
                useFlowStore.getState().clearStreaming();
            }, 0);
        } else if (executionStatus === "error" && isLoading) {
            setIsLoading(false);
            setMessages((prev) => [...prev, { role: "assistant", content: ERROR_MSG, timestamp: new Date() }]);
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
        const enableFileInput = inputNodeData?.enableFileInput === true;
        const enableStructuredForm = inputNodeData?.enableStructuredForm === true;
        const currentFlowId = useFlowStore.getState().currentFlowId;

        // 检查是否有内容可发送
        const hasText = input.trim().length > 0;
        const hasFiles = files && files.length > 0;
        const hasFormData = enableStructuredForm && inputNodeData?.formFields?.length && inputNodeData?.formData;

        // 统一验证：根据启用的模式判断是否可发送
        const hasValidContent =
            (enableTextInput && hasText) ||
            (enableFileInput && hasFiles) ||
            (enableStructuredForm && hasFormData);
        if (!hasValidContent) return;
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

        // 上传文件并获取 URL（如果有文件）
        let uploadedFiles: { name: string; size: number; type: string; url: string }[] = [];
        if (hasFiles && inputNode && currentFlowId) {
            try {
                const uploadPromises = files.map(async (file) => {
                    const result = await fileUploadService.uploadFile(file, inputNode.id, currentFlowId);
                    if (result) {
                        return {
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            url: result.url,
                        };
                    }
                    return null;
                });
                const results = await Promise.all(uploadPromises);
                uploadedFiles = results.filter((f): f is NonNullable<typeof f> => f !== null);
            } catch (error) {
                console.error("文件上传失败:", error);
                showError("文件上传失败", "请检查网络连接后重试");
            }
        }

        // 更新 Input Node 并运行 Flow（传递 sessionId 用于记忆功能）
        if (inputNode) {
            updateNodeData(inputNode.id, {
                text: input,
                files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
            });
        }
        await runFlow(sessionId);
    };


    // Compute display messages: append streaming text as partial assistant message
    const displayMessages = useMemo(() => {
        if (!isLoading) return messages;

        // Handle segmented streaming (merge mode)
        if (streamingMode === 'segmented' && streamingSegments.length > 0) {
            // Check if any segment is still streaming or waiting
            const hasActiveSegment = streamingSegments.some(s => s.status === 'streaming' || s.status === 'waiting');

            // Concatenate all segment contents that have data
            const combinedContent = streamingSegments
                .filter(s => s.content)
                .map(s => s.content)
                .join('\n\n');

            if (combinedContent) {
                return [...messages, { role: "assistant" as const, content: combinedContent, timestamp: new Date() }];
            }

            // If no content yet but streaming, return messages (isLoading will show loading indicator)
            return messages;
        }

        // Handle single/select streaming (existing logic)
        if (isStreaming && streamingText) {
            return [...messages, { role: "assistant" as const, content: streamingText, timestamp: new Date() }];
        }

        return messages;
    }, [messages, isStreaming, streamingText, isLoading, streamingMode, streamingSegments]);

    // Determine if we should show loading indicator
    // For merge mode: show loading when waiting for segments
    // For select mode: show loading when no content yet (waiting for first char lock)
    const showLoading = useMemo(() => {
        if (!isLoading) return false;

        // In segmented mode (merge), show loading in these cases:
        // 1. Segments not initialized yet
        // 2. No content has been produced yet
        // 3. A segment completed and next is waiting (between segments)
        if (streamingMode === 'segmented') {
            // Case 1: Segments not initialized
            if (streamingSegments.length === 0) {
                return true;
            }

            // Case 2: No content yet (first segment hasn't started)
            const hasAnyContent = streamingSegments.some(s => s.content.length > 0);
            if (!hasAnyContent) {
                return true;
            }

            // Case 3: Between segments - a completed segment and a waiting one exists
            const hasCompleted = streamingSegments.some(s => s.status === 'completed');
            const hasWaiting = streamingSegments.some(s => s.status === 'waiting');
            if (hasCompleted && hasWaiting) {
                // Check if any segment is actively streaming
                const hasStreaming = streamingSegments.some(s => s.status === 'streaming');
                return !hasStreaming; // Show loading only if nothing is actively streaming
            }

            return false;
        }

        // In select mode, show loading until we have streaming content
        if (streamingMode === 'select') {
            // Show loading if there's no streaming content yet
            return !streamingText;
        }

        // For single/direct modes, show loading when not streaming
        return !isStreaming;
    }, [isLoading, isStreaming, streamingMode, streamingSegments, streamingText]);

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
                        isLoading={showLoading}
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

