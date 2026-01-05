import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useFlowStore } from '@/store/flowStore';
import { chatHistoryAPI } from '@/services/chatHistoryAPI';
import { quotaService } from '@/services/quotaService';
import { authService } from '@/services/authService';
import { extractOutputFromContext, extractTextFromUpstream } from '@/store/executors/contextUtils';
import { showWarning } from '@/utils/errorNotify';
import { useChatSession } from './useChatSession';
import type { AppNode } from '@/types/flow';

// ============ Constants ============
const MESSAGES = {
    ERROR_EXECUTION: "画布工作流出错",
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
    const streamingReasoning = useFlowStore((s) => s.streamingReasoning);
    const isStreaming = useFlowStore((s) => s.isStreaming);
    const isStreamingReasoning = useFlowStore((s) => s.isStreamingReasoning);

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

                // 检查是否有文件上传失败
                const failedCount = files!.length - uploadedFiles.length;
                if (failedCount > 0) {
                    showWarning(
                        "部分文件上传失败",
                        `${failedCount} 个文件未能上传，请检查网络后重试`
                    );
                }
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
            // Check Output Node mode to determine if we should show reasoning
            const outputNode = freshState.nodes.find(n => n.type === 'output');
            const outputMode = (outputNode?.data as any)?.inputMappings?.mode || 'direct';
            // Only show reasoning in direct or select modes
            const shouldShowReasoning = outputMode === 'direct' || outputMode === 'select';

            const responseReasoning = shouldShowReasoning ? (freshState.streamingReasoning || null) : null;
            let tokenUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;

            if (freshState.executionStatus === "completed") {
                const output = extractOutputFromContext(freshState.nodes, freshState.flowContext);
                responseText = output.text;
                responseAttachments = output.attachments;

                // NOTE: Reasoning 现在需要在 Output 节点模板中显式引用 {{节点.reasoning}}
                // 不再自动从 flowContext 提取

                // Extract token usage from LLM nodes in context
                for (const [nodeId, nodeOutput] of Object.entries(freshState.flowContext)) {
                    if (nodeId.startsWith('_')) continue;
                    const data = nodeOutput as Record<string, unknown>;
                    if (data?.usage && typeof data.usage === 'object') {
                        tokenUsage = data.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number };
                    }
                }
            } else {
                responseText = MESSAGES.ERROR_EXECUTION;
            }

            // 9. Persist AI Response FIRST (with retry) - before updating UI
            if (currentMessageId) {
                const maxRetries = 2;
                let persistSuccess = false;
                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    const success = await chatHistoryAPI.updateAssistantMessage(
                        currentMessageId,
                        responseText,
                        responseAttachments,
                        responseReasoning,
                        tokenUsage
                    );
                    if (success) {
                        persistSuccess = true;
                        break;
                    }
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    }
                }
                if (!persistSuccess) {
                    showWarning("回复保存失败", "AI回复未能保存到服务器，刷新后可能丢失");
                }
            }

            // 10. Update UI (after persistence to ensure data consistency)
            useFlowStore.getState().clearStreaming();
            setIsLoading(false);

            if (activeSessionIdRef.current !== activeSessionId) return;

            const updatedMessages = [
                ...newMessages,
                {
                    role: "assistant" as const,
                    content: responseText,
                    attachments: responseAttachments,
                    reasoning: responseReasoning || undefined,
                    timestamp: new Date()
                }
            ];
            setMessages(updatedMessages);
            updateSessionCache(activeSessionId, updatedMessages, false);

            // 11. Increment Quota (async, non-blocking)
            try {
                if (currentUser) {
                    await quotaService.incrementUsage(currentUser.id, "app_usages");
                    const { refreshQuota } = await import("@/store/quotaStore").then(m => m.useQuotaStore.getState());
                    await refreshQuota(currentUser.id);
                }
            } catch (e) {
                console.error("Quota increment failed:", e);
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
        streamingReasoning,
        isStreaming,
        isStreamingReasoning,
    };
}
