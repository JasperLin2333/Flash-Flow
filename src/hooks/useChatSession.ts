import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { chatHistoryAPI } from '@/services/chatHistoryAPI';
import { useFlowStore } from '@/store/flowStore';
import type { ChatMessage, ChatSession } from '@/types/chat';

interface UseChatSessionProps {
    flowId: string | null;
}

export function useChatSession({ flowId }: UseChatSessionProps) {
    const router = useRouter();

    // State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Refs
    const sessionCacheRef = useRef<Map<string, ChatSession>>(new Map());
    const activeSessionIdRef = useRef<string | null>(null);
    const isLoadingHistoryRef = useRef(false);

    // Actions
    const updateSessionCache = useCallback((sessionId: string, newMessages: ChatMessage[], isExecuting: boolean) => {
        sessionCacheRef.current.set(sessionId, {
            sessionId,
            messages: newMessages,
            isExecuting,
        });
    }, []);

    const loadSession = useCallback(async (sessionId: string) => {
        if (!flowId || isLoadingHistoryRef.current) return;

        if (sessionId === activeSessionIdRef.current) {
            const cached = sessionCacheRef.current.get(sessionId);
            if (cached && cached.messages.length > 0) return;
        }

        try {
            isLoadingHistoryRef.current = true;
            activeSessionIdRef.current = sessionId;

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

            if (activeSessionIdRef.current !== sessionId) return;

            if (!history || history.length === 0) {
                // Legacy fallback logic
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
            history.forEach((record, index) => {
                msgs.push({ role: "user", content: record.user_message });
                if (record.assistant_message) {
                    msgs.push({ role: "assistant", content: record.assistant_message });
                } else if (index === history.length - 1) {
                    msgs.push({ role: "assistant", content: "(上次执行被中断，请重新发送消息)" });
                }
            });

            setMessages(msgs);
            setCurrentSessionId(sessionId);
            setIsLoading(false);

            updateSessionCache(sessionId, msgs, false);

        } catch (error) {
            console.error("Failed to load chat history:", error);
        } finally {
            isLoadingHistoryRef.current = false;
        }
    }, [flowId, updateSessionCache]);

    const startNewSession = useCallback(() => {
        if (currentSessionId && messages.length > 0) {
            let sessionMessages = [...messages];
            if (isLoading) {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage?.role === "user") {
                    sessionMessages = [
                        ...messages,
                        { role: "assistant" as const, content: "(上次执行被中断，请重新发送消息)" }
                    ];
                }
            }
            updateSessionCache(currentSessionId, sessionMessages, false);
        }

        setMessages([]);
        setCurrentSessionId(null);
        setIsLoading(false);
        activeSessionIdRef.current = null;

        useFlowStore.getState().abortStreaming();
        router.replace(`/app?flowId=${flowId}`);
        setRefreshTrigger(prev => prev + 1);
    }, [flowId, router, currentSessionId, messages, isLoading, updateSessionCache]);

    return {
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
    };
}
