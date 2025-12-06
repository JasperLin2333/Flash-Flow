import { useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useFlowStore } from '@/store/flowStore';
import { chatHistoryAPI } from '@/services/chatHistoryAPI';
import { quotaService } from '@/services/quotaService';
import { authService } from '@/services/authService';
import { extractTextFromUpstream } from '@/store/executors/contextUtils';
import type { AppNode } from '@/types/flow';

// ============ Constants ============
const MESSAGES = {
    ERROR_EXECUTION: "工作流执行失败，请稍后重试。",
    EMPTY_OUTPUT: "工作流已完成，但未生成输出。",
} as const;

// ============ Types ============
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface ChatSession {
    sessionId: string;
    messages: ChatMessage[];
    isExecuting: boolean;
}

interface UseFlowChatProps {
    flowId: string | null;
}

export function useFlowChat({ flowId }: UseFlowChatProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Store Actions
    const runFlow = useFlowStore((s) => s.runFlow);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const nodes = useFlowStore((s) => s.nodes);

    // Streaming state from store
    const streamingText = useFlowStore((s) => s.streamingText);
    const isStreaming = useFlowStore((s) => s.isStreaming);

    // Local State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Refs for Concurrency Control & Caching
    const sessionCacheRef = useRef<Map<string, ChatSession>>(new Map());
    const activeSessionIdRef = useRef<string | null>(null);
    const isLoadingHistoryRef = useRef(false);

    // ============ Helpers ============

    // 使用共享的 extractTextFromUpstream 函数来正确过滤 Branch 节点元数据
    const extractFlowOutput = (
        currentNodes: AppNode[],
        currentContext: Record<string, unknown>
    ): string => {
        const outputNode = currentNodes.find(n => n.type === "output");

        if (!outputNode) {
            return "请在工作流中添加 Output 节点以显示输出结果。";
        }

        const outData = currentContext[outputNode.id] as Record<string, unknown> | undefined;
        if (!outData) {
            return MESSAGES.EMPTY_OUTPUT;
        }

        // 使用共享工具函数正确过滤 Branch 节点元数据
        return extractTextFromUpstream(outData, true) || MESSAGES.EMPTY_OUTPUT;
    };

    // ============ Actions ============

    const loadSession = useCallback(async (sessionId: string) => {
        if (!flowId || isLoadingHistoryRef.current) return;

        // Prevent re-loading current session if it's already active
        // Use ref instead of state to avoid dependency issues
        if (sessionId === activeSessionIdRef.current) {
            const cached = sessionCacheRef.current.get(sessionId);
            if (cached && cached.messages.length > 0) return;
        }

        try {
            isLoadingHistoryRef.current = true;
            activeSessionIdRef.current = sessionId; // Mark as active immediately

            // 1. Check Cache
            const cachedSession = sessionCacheRef.current.get(sessionId);
            if (cachedSession) {
                setMessages(cachedSession.messages);
                setCurrentSessionId(sessionId);
                setIsLoading(cachedSession.isExecuting);
                return;
            }

            // 2. Fetch from API
            const history = await chatHistoryAPI.getSessionMessages(sessionId);

            // Race condition check: Did the user switch sessions while we were fetching?
            if (activeSessionIdRef.current !== sessionId) return;

            if (!history || history.length === 0) {
                // Handle legacy fallback
                const legacyMsg = await chatHistoryAPI.getMessageById(sessionId);
                if (activeSessionIdRef.current !== sessionId) return;

                if (legacyMsg) {
                    const msgs: ChatMessage[] = [
                        { role: "user", content: legacyMsg.user_message },
                        ...(legacyMsg.assistant_message ? [{ role: "assistant" as const, content: legacyMsg.assistant_message }] : [])
                    ];
                    setMessages(msgs);
                    setCurrentSessionId(sessionId);
                    return;
                }
                console.warn(`Session not found: ${sessionId}`);
                return;
            }

            const msgs: ChatMessage[] = [];
            let hasIncompleteMessage = false;

            history.forEach((record, index) => {
                msgs.push({ role: "user", content: record.user_message });
                if (record.assistant_message) {
                    msgs.push({ role: "assistant", content: record.assistant_message });
                } else if (index === history.length - 1) {
                    // Last message has no assistant response - likely interrupted by refresh
                    hasIncompleteMessage = true;
                    msgs.push({ role: "assistant", content: "(上次执行被中断，请重新发送消息)" });
                }
            });

            setMessages(msgs);
            setCurrentSessionId(sessionId);
            setIsLoading(false);

            // Update Cache
            sessionCacheRef.current.set(sessionId, {
                sessionId: sessionId,
                messages: msgs,
                isExecuting: false,
            });

        } catch (error) {
            console.error("Failed to load chat history:", error);
        } finally {
            isLoadingHistoryRef.current = false;
        }
    }, [flowId]);

    const startNewSession = useCallback(() => {
        // Save current session to cache if valid
        if (currentSessionId && messages.length > 0) {
            // 如果正在执行中，添加中断提示消息并标记为不再执行中（与刷新逻辑保持一致）
            let sessionMessages = [...messages];
            if (isLoading) {
                // 检查最后一条消息是否是用户消息（说明 AI 还没回复完）
                const lastMessage = messages[messages.length - 1];
                if (lastMessage?.role === "user") {
                    sessionMessages = [
                        ...messages,
                        { role: "assistant" as const, content: "(上次执行被中断，请重新发送消息)" }
                    ];
                }
            }
            sessionCacheRef.current.set(currentSessionId, {
                sessionId: currentSessionId,
                messages: sessionMessages,
                isExecuting: false, // 不再标记为执行中，与刷新逻辑保持一致
            });
        }

        // Reset State
        setMessages([]);
        setInput("");
        setCurrentSessionId(null);
        setIsLoading(false);
        activeSessionIdRef.current = null;

        // Abort streaming to stop displaying AI response (marks as intentionally interrupted)
        useFlowStore.getState().abortStreaming();

        // Clean URL
        router.replace(`/app?flowId=${flowId}`);
        setRefreshTrigger(prev => prev + 1);
    }, [flowId, router, currentSessionId, messages, isLoading]);

    const sendMessage = async () => {
        // 获取 Input 节点配置
        const inputNodes = nodes.filter(n => n.type === "input");
        const inputNode = inputNodes[0];
        const inputNodeData = inputNode?.data as import("@/types/flow").InputNodeData | undefined;
        const enableTextInput = inputNodeData?.enableTextInput !== false;

        // 检查是否有内容可发送
        const hasText = input.trim().length > 0;
        const hasFormData = inputNodeData?.enableStructuredForm && inputNodeData?.formFields?.length;

        // 如果启用文本输入但没有文本，不发送
        if (enableTextInput && !hasText) return;
        // 如果禁用文本输入，但也没有表单数据，不发送
        if (!enableTextInput && !hasFormData) return;
        if (isLoading || !flowId) return;


        // QUOTA CHECK: Verify user has remaining app usage quota
        try {
            const user = await authService.getCurrentUser();

            // Require authentication
            if (!user) {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: "请先登录以使用 APP 功能。"
                }]);
                return;
            }

            // Check quota availability
            const quotaCheck = await quotaService.checkQuota(user.id, "app_usages");
            if (!quotaCheck.allowed) {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: `您的 APP 使用次数已用完 (${quotaCheck.used}/${quotaCheck.limit})。请联系管理员增加配额以继续使用。`
                }]);
                return;
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error("[useFlowChat] Quota check failed:", errorMsg);

            // SECURITY FIX: Fail fast instead of degraded mode
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "配额检查失败，请稍后重试。如果问题持续，请联系支持。"
            }]);
            return;
        }

        // 构建用户消息（支持空文本时显示友好提示）
        const userMsg = hasText
            ? input
            : "📋 已通过表单提交信息";

        // 1. Determine Session ID FIRST (before any UI updates)
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            activeSessionId = nanoid();
            // Update URL silently (no state update yet)
            window.history.replaceState(null, '', `/app?flowId=${flowId}&chatId=${activeSessionId}`);
        }

        // 2. Batch UI Updates: Add message + set loading + clear input together
        // This reduces intermediate renders and prevents flicker
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];

        // Update all states in quick succession (React 18 batches these automatically)
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);
        if (!currentSessionId) {
            setCurrentSessionId(activeSessionId);
            activeSessionIdRef.current = activeSessionId;
        }

        // Update Cache
        sessionCacheRef.current.set(activeSessionId, {
            sessionId: activeSessionId,
            messages: newMessages,
            isExecuting: true,
        });

        let currentMessageId: string | null = null;

        try {
            // 3. Persist User Message
            const chatRecord = await chatHistoryAPI.addMessage(flowId, userMsg, activeSessionId);

            // Race Check
            if (activeSessionIdRef.current !== activeSessionId) return;

            if (chatRecord) {
                currentMessageId = chatRecord.id;
                setRefreshTrigger(prev => prev + 1);
            }

            // 4. Update Input Nodes
            const inputNodes = nodes.filter(n => n.type === "input");
            if (inputNodes.length > 0) {
                for (const n of inputNodes) {
                    updateNodeData(n.id, { text: userMsg });
                }
            }

            // 5. Run Flow（传递 sessionId 用于 LLM 记忆功能）
            await runFlow(activeSessionId);

            // Race Check
            if (activeSessionIdRef.current !== activeSessionId) return;

            // 6. Handle Result
            const freshState = useFlowStore.getState();
            let responseText = "";

            if (freshState.executionStatus === "completed") {
                responseText = extractFlowOutput(freshState.nodes, freshState.flowContext);
            } else if (freshState.executionStatus === "error") {
                responseText = MESSAGES.ERROR_EXECUTION;
            } else {
                responseText = MESSAGES.ERROR_EXECUTION;
            }

            // 7. Update UI - Clear streaming and loading BEFORE adding message to prevent flash
            useFlowStore.getState().clearStreaming();
            setIsLoading(false);

            // Race check again before updating messages (React state updates are async)
            if (activeSessionIdRef.current !== activeSessionId) return;

            setMessages(prev => {
                // Double check inside callback to prevent cache corruption after session switch
                if (activeSessionIdRef.current !== activeSessionId) {
                    return prev; // Don't update if session changed
                }
                const updatedMessages = [...prev, { role: "assistant" as const, content: responseText }];
                sessionCacheRef.current.set(activeSessionId!, {
                    sessionId: activeSessionId!,
                    messages: updatedMessages,
                    isExecuting: false,
                });
                return updatedMessages;
            });

            // QUOTA INCREMENT: Track successful app usage
            try {
                const user = await authService.getCurrentUser();
                if (user) {
                    const updated = await quotaService.incrementUsage(user.id, "app_usages");
                    if (!updated) {
                        console.warn("[useFlowChat] Failed to increment quota - quota service returned null");
                    } else {
                        // 🧹 CODE IMPROVEMENT: Refresh quota display for user feedback
                        const { refreshQuota } = await import("@/store/quotaStore").then(m => m.useQuotaStore.getState());
                        await refreshQuota(user.id);
                    }
                } else {
                    console.warn("[useFlowChat] Cannot increment quota - user not authenticated");
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error("[useFlowChat] Failed to increment quota:", errorMsg);
                // DEFENSIVE: We don't show error to user since message was sent successfully
            }

            // 8. Persist Response - only if session is still active
            if (currentMessageId && activeSessionIdRef.current === activeSessionId) {
                chatHistoryAPI.updateAssistantMessage(currentMessageId, responseText)
                    .catch(e => console.error("Failed to persist response:", e));
            }

        } catch (error) {
            console.error("Critical error in sendMessage:", error);
            if (activeSessionIdRef.current === activeSessionId) {
                useFlowStore.getState().clearStreaming();
                setIsLoading(false);
                setMessages(prev => [...prev, { role: "assistant", content: MESSAGES.ERROR_EXECUTION }]);
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
        // Streaming state for real-time display
        streamingText,
        isStreaming,
    };
}
