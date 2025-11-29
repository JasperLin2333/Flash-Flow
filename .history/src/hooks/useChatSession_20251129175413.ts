import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";

export interface Message {
    role: "user" | "assistant";
    content: string;
}

export interface ChatSession {
    chatId: string;
    messages: Message[];
    isExecuting: boolean;
}

interface UseChatSessionProps {
    flowId: string | null;
}

export function useChatSession({ flowId }: UseChatSessionProps) {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Session cache to prevent re-fetching and preserve state during navigation
    const sessionCacheRef = useRef<Map<string, ChatSession>>(new Map());
    const loadingHistoryRef = useRef(false);

    /**
     * Load chat history from cache or API
     */
    const loadChatHistory = useCallback(async (chatId: string, skipUrlUpdate: boolean = false) => {
        if (!flowId || loadingHistoryRef.current) return;

        try {
            loadingHistoryRef.current = true;
            setIsLoadingHistory(true);

            // 1. Check Cache
            const cachedSession = sessionCacheRef.current.get(chatId);
            if (cachedSession) {
                console.log(`[useChatSession] Cache hit: ${chatId}`);
                setMessages(cachedSession.messages);
                setCurrentChatId(chatId);

                if (!skipUrlUpdate) {
                    router.push(`/app?flowId=${flowId}&chatId=${chatId}`);
                }
                return;
            }

            // 2. Fetch from API
            console.log(`[useChatSession] Fetching history: ${chatId}`);
            const history = await chatHistoryAPI.getHistory(flowId);
            const targetChat = history.find(chat => chat.id === chatId);

            if (!targetChat) {
                console.warn(`[useChatSession] Chat not found: ${chatId}`);
                return;
            }

            // 3. Reconstruct Messages
            const msgs: Message[] = [
                { role: "user", content: targetChat.user_message }
            ];

            if (targetChat.assistant_message) {
                msgs.push({ role: "assistant", content: targetChat.assistant_message });
            }

            setMessages(msgs);
            setCurrentChatId(chatId);

            // 4. Update Cache
            sessionCacheRef.current.set(chatId, {
                chatId,
                messages: msgs,
                isExecuting: false, // History is always finished state unless we persist execution state (which we don't yet)
            });

            // 5. Update URL
            if (!skipUrlUpdate) {
                router.push(`/app?flowId=${flowId}&chatId=${chatId}`);
            }

        } catch (error) {
            console.error("[useChatSession] Failed to load history:", error);
            // TODO: Add toast notification here
        } finally {
            loadingHistoryRef.current = false;
            setIsLoadingHistory(false);
        }
    }, [flowId, router]);

    /**
     * Start a new conversation
     */
    const startNewConversation = useCallback(() => {
        // Save current session to cache before clearing
        if (currentChatId && messages.length > 0) {
            sessionCacheRef.current.set(currentChatId, {
                chatId: currentChatId,
                messages: [...messages],
                isExecuting: false, // Assuming we don't allow new chat while executing, or we mark it as interrupted
            });
        }

        setMessages([]);
        setCurrentChatId(null);

        if (flowId) {
            router.push(`/app?flowId=${flowId}`);
        }
    }, [currentChatId, messages, flowId, router]);

    /**
     * Update messages and cache for the current chat
     */
    const updateMessages = useCallback((newMessages: Message[]) => {
        setMessages(newMessages);

        if (currentChatId) {
            const currentSession = sessionCacheRef.current.get(currentChatId);
            sessionCacheRef.current.set(currentChatId, {
                chatId: currentChatId,
                messages: newMessages,
                isExecuting: currentSession?.isExecuting || false,
            });
        }
    }, [currentChatId]);

    /**
     * Initialize a new chat session after sending the first message
     */
    const initChatSession = useCallback((chatId: string, initialMessages: Message[]) => {
        setCurrentChatId(chatId);
        setMessages(initialMessages);

        sessionCacheRef.current.set(chatId, {
            chatId,
            messages: initialMessages,
            isExecuting: true,
        });

        if (flowId) {
            router.push(`/app?flowId=${flowId}&chatId=${chatId}`);
        }
    }, [flowId, router]);

    return {
        messages,
        currentChatId,
        isLoadingHistory,
        loadChatHistory,
        startNewConversation,
        updateMessages,
        initChatSession,
        setMessages, // Expose for direct manipulation if needed (e.g. optimistic updates)
    };
}
