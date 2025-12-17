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
    const sendMessage = async () => {
        // 1. Validate Input
        const inputNodes = nodes.filter(n => n.type === "input");
        const inputNode = inputNodes[0];
        const inputNodeData = inputNode?.data as import("@/types/flow").InputNodeData | undefined;
        const enableTextInput = inputNodeData?.enableTextInput !== false;

        const hasText = input.trim().length > 0;
        const hasFormData = inputNodeData?.enableStructuredForm && inputNodeData?.formFields?.length;

        if (enableTextInput && !hasText) return;
        if (!enableTextInput && !hasFormData) return;
        if (isLoading || !flowId) return;

        // 2. Validate Quota
        try {
            const user = await authService.getCurrentUser();
            if (!user) {
                setMessages(prev => [...prev, { role: "assistant", content: "请先登录以使用 APP 功能。", timestamp: new Date() }]);
                return;
            }

            const quotaCheck = await quotaService.checkQuota(user.id, "app_usages");
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
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        updateSessionCache(activeSessionId, newMessages, true);

        let currentMessageId: string | null = null;

        try {
            // 5. Persist User Message
            const chatRecord = await chatHistoryAPI.addMessage(flowId, userMsg, activeSessionId);
            if (activeSessionIdRef.current !== activeSessionId) return;

            if (chatRecord) {
                currentMessageId = chatRecord.id;
                setRefreshTrigger(prev => prev + 1);
            }

            // 6. Update Inputs & Run Flow
            if (inputNodes.length > 0) {
                for (const n of inputNodes) {
                    const nodeData = n.data as import("@/types/flow").InputNodeData;
                    // 传递 formData（如果启用了结构化表单）
                    updateNodeData(n.id, {
                        text: userMsg,
                        formData: nodeData?.formData,
                    });
                }
            }

            await runFlow(activeSessionId);
            if (activeSessionIdRef.current !== activeSessionId) return;

            // 7. Handle Result
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

            // 8. Update UI
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

            // 9. Increment Quota & Persist Response
            try {
                const user = await authService.getCurrentUser();
                if (user) {
                    await quotaService.incrementUsage(user.id, "app_usages");
                    const { refreshQuota } = await import("@/store/quotaStore").then(m => m.useQuotaStore.getState());
                    await refreshQuota(user.id);
                }
            } catch (e) {
                console.error("Quota increment failed:", e);
            }

            if (currentMessageId) {
                chatHistoryAPI.updateAssistantMessage(currentMessageId, responseText)
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
