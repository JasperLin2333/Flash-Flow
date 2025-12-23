import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useFlowStore } from '@/store/flowStore';
import { chatHistoryAPI } from '@/services/chatHistoryAPI';
import { quotaService } from '@/services/quotaService';
import { authService } from '@/services/authService';
import { extractOutputFromContext, extractTextFromUpstream } from '@/store/executors/contextUtils';
import { useChatSession } from './useChatSession';
import type { AppNode } from '@/types/flow';

// ============ Constants ============
const MESSAGES = {
    ERROR_EXECUTION: "工作流执行失败，请稍后重试。",
    EMPTY_OUTPUT: "工作流已完成，但未生成输出。",
} as const;

interface UseFlowChatProps {
    flowId: string | null;
}

export function useFlowChat({ flowId }: UseFlowChatProps) {
    const searchParams = useSearchParams();

    // Store Actions
    const runFlow = useFlowStore((s) => s.runFlow);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const nodes = useFlowStore((s) => s.nodes);

    // Streaming state from store
    const streamingText = useFlowStore((s) => s.streamingText);
    const isStreaming = useFlowStore((s) => s.isStreaming);

    // Derived Logic
    const {
        messages,
        setMessages,
        isLoading,
        setIsLoading,
        currentSessionId,
        setCurrentSessionId,
        refreshTrigger,
        setRefreshTrigger,
        loadSession,
        startNewSession,
        sessionCacheRef,
        activeSessionIdRef,
        updateSessionCache
    } = useChatSession({ flowId });

    // Local UI State
    const [input, setInput] = useState("");

    // ============ Helpers ============


    // ============ Actions ============
    const sendMessage = async (files?: File[]) => {
        // RACE CONDITION FIX: 立即清除旧的流式状态
        // WHY: 防止旧的 streamingText 在 useMemo 中被识别为新的 AI 回复
        // TIMING: 必须在 setIsLoading(true) 和添加新消息到 messages 之前调用
        // 否则 page.tsx 中的 useMemo 会将旧的 streamingText 显示为新回复
        useFlowStore.getState().clearStreaming();

        // 1. Validate Input
        const inputNodes = nodes.filter(n => n.type === "input");
        const inputNode = inputNodes[0];
        const inputNodeData = inputNode?.data as import("@/types/flow").InputNodeData | undefined;
        const enableTextInput = inputNodeData?.enableTextInput !== false;
        const enableFileInput = inputNodeData?.enableFileInput === true;
        const enableStructuredForm = inputNodeData?.enableStructuredForm === true;

        const hasText = input.trim().length > 0;
        const hasFiles = (files?.length ?? 0) > 0;
        const hasFormData = enableStructuredForm && inputNodeData?.formFields?.length;

        // 统一验证：根据启用的模式判断是否可发送
        const hasValidContent =
            (enableTextInput && hasText) ||
            (enableFileInput && hasFiles) ||
            (enableStructuredForm && hasFormData);
        if (!hasValidContent) return;
        if (isLoading || !flowId) return;

        let currentUser: any = null;

        // 2. Validate Quota
        try {
            currentUser = await authService.getCurrentUser();
            if (!currentUser) {
                setMessages(prev => [...prev, { role: "assistant", content: "请先登录以使用 APP 功能。", timestamp: new Date() }]);
                return;
            }

            const quotaCheck = await quotaService.checkQuota(currentUser.id, "app_usages");
            if (!quotaCheck.allowed) {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: `您的 APP 使用次数已用完 (${quotaCheck.used}/${quotaCheck.limit})。请联系管理员增加配额以继续使用。`,
                    timestamp: new Date()
                }]);
                return;
            }
        } catch (e) {
            console.error("[useFlowChat] Quota check failed:", e);
            setMessages(prev => [...prev, { role: "assistant", content: "配额检查失败，请稍后重试。", timestamp: new Date() }]);
            return;
        }

        // 3. Prepare Session
        const userMsg = hasText ? input : "📋 已通过表单提交信息";
        let activeSessionId = currentSessionId;

        if (!activeSessionId) {
            activeSessionId = nanoid();
            window.history.replaceState(null, '', `/app?flowId=${flowId}&chatId=${activeSessionId}`);
            setCurrentSessionId(activeSessionId);
            activeSessionIdRef.current = activeSessionId;
        }

        // 4. Optimistic Update
        const newMessages = [
            ...messages,
            {
                role: "user" as const,
                content: userMsg,
                files: files // 保存原始文件对象以便立即显示
            }
        ];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        updateSessionCache(activeSessionId, newMessages, true);

        let currentMessageId: string | null = null;

        try {
            // 6. Handle File Uploads (if any)
            let uploadedFiles: any[] = [];
            if (hasFiles && inputNode) {
                const { fileUploadService } = await import("@/services/fileUploadService");
                const uploadPromises = files!.map(file =>
                    fileUploadService.completeUpload(file, inputNode.id, flowId, currentUser?.id)
                );
                const results = await Promise.all(uploadPromises);
                uploadedFiles = results.filter(f => f !== null);
            }

            // 5. Persist User Message (Now with uploaded attachments)
            const chatRecord = await chatHistoryAPI.addMessage(flowId, userMsg, activeSessionId, null, uploadedFiles.length > 0 ? uploadedFiles : null);
            if (activeSessionIdRef.current !== activeSessionId) return;

            if (chatRecord) {
                currentMessageId = chatRecord.id;
                setRefreshTrigger(prev => prev + 1);
            }

            // 7. Update Inputs & Run Flow
            if (inputNodes.length > 0) {
                for (const n of inputNodes) {
                    const nodeData = n.data as import("@/types/flow").InputNodeData;
                    // 传递 formData（如果启用了结构化表单）和已上传的文件
                    updateNodeData(n.id, {
                        text: userMsg,
                        formData: nodeData?.formData,
                        files: uploadedFiles.length > 0 ? uploadedFiles : undefined
                    });
                }
            }

            await runFlow(activeSessionId);
            if (activeSessionIdRef.current !== activeSessionId) return;

            // 8. Handle Result
            const freshState = useFlowStore.getState();
            let responseText = "";
            let responseAttachments: import("@/components/apps/FlowAppInterface/constants").Attachment[] = [];

            if (freshState.executionStatus === "completed") {
                const output = extractOutputFromContext(freshState.nodes, freshState.flowContext);
                responseText = output.text;
                responseAttachments = output.attachments;
            } else {
                responseText = MESSAGES.ERROR_EXECUTION;
            }

            // 9. Update UI
            useFlowStore.getState().clearStreaming();
            setIsLoading(false);

            if (activeSessionIdRef.current !== activeSessionId) return;

            const updatedMessages = [
                ...newMessages,
                {
                    role: "assistant" as const,
                    content: responseText,
                    attachments: responseAttachments,
                    timestamp: new Date()
                }
            ];
            setMessages(updatedMessages);
            updateSessionCache(activeSessionId, updatedMessages, false);

            // 10. Increment Quota & Persist Response
            try {
                if (currentUser) {
                    await quotaService.incrementUsage(currentUser.id, "app_usages");
                    const { refreshQuota } = await import("@/store/quotaStore").then(m => m.useQuotaStore.getState());
                    await refreshQuota(currentUser.id);
                }
            } catch (e) {
                console.error("Quota increment failed:", e);
            }

            if (currentMessageId) {
                chatHistoryAPI.updateAssistantMessage(currentMessageId, responseText, responseAttachments)
                    .catch(e => console.error("Failed to persist response:", e));
            }

        } catch (error) {
            console.error("Critical error in sendMessage:", error);
            if (activeSessionIdRef.current === activeSessionId) {
                useFlowStore.getState().clearStreaming();
                setIsLoading(false);
                setMessages(prev => [...prev, { role: "assistant", content: MESSAGES.ERROR_EXECUTION, timestamp: new Date() }]);
            }
        } finally {
            if (activeSessionIdRef.current === activeSessionId) {
                setRefreshTrigger(prev => prev + 1);
            }
        }
    };

    return {
        messages,
        input,
        setInput,
        isLoading,
        currentSessionId,
        refreshTrigger,
        loadSession,
        startNewSession,
        sendMessage,
        streamingText,
        isStreaming,
    };
}
