import { useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useFlowStore } from '@/store/flowStore';
import { chatHistoryAPI } from '@/services/chatHistoryAPI';
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

    const extractTextFromOutput = (data: Record<string, unknown> | undefined): string => {
        if (!data || typeof data !== 'object') return '';
        if (typeof data.text === 'string' && data.text) return data.text;
        if (typeof data.response === 'string' && data.response) return data.response;
        if ('error' in data) {
            const err = data['error'];
            if (typeof err === 'string' && err) return err;
        }
        if (typeof data.query === 'string' && data.query) return data.query;
        return Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
    };

    const extractFlowOutput = (
        currentNodes: AppNode[],
        currentContext: Record<string, unknown>
    ): string => {
        const outputNode = currentNodes.find(n => n.type === "output");
        if (outputNode) {
            const outData = currentContext[outputNode.id] as Record<string, unknown> | undefined;
            if (outData) {
                return extractTextFromOutput(outData);
            }
        }

        const executedNodes = currentNodes.filter(n =>
            n.data.executionTime !== undefined &&
            currentContext[n.id] !== undefined
        );

        if (executedNodes.length > 0) {
            executedNodes.sort((a, b) => {
                const tA = (a.data.executionTime as number) || 0;
                const tB = (b.data.executionTime as number) || 0;
                return tB - tA;
            });

            for (const node of executedNodes) {
                const outData = currentContext[node.id] as Record<string, unknown>;
                const text = extractTextFromOutput(outData);
                if (text) return text;
            }
        }

        return MESSAGES.EMPTY_OUTPUT;
    };

    // ============ Actions ============

    const loadSession = useCallback(async (sessionId: string) => {
        if (!flowId || isLoadingHistoryRef.current) return;

        // Prevent re-loading current session if it's already active
        if (sessionId === activeSessionIdRef.current && messages.length > 0) return;

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
            history.forEach(record => {
                msgs.push({ role: "user", content: record.user_message });
                if (record.assistant_message) {
                    msgs.push({ role: "assistant", content: record.assistant_message });
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
    }, [flowId, messages.length]);

    const startNewSession = useCallback(() => {
        // Save current session to cache if valid
        if (currentSessionId && messages.length > 0) {
            sessionCacheRef.current.set(currentSessionId, {
                sessionId: currentSessionId,
                messages: [...messages],
                isExecuting: isLoading,
            });
        }

        // Reset State
        setMessages([]);
        setInput("");
        setCurrentSessionId(null);
        setIsLoading(false);
        activeSessionIdRef.current = null;

        // Clean URL
        router.replace(`/app?flowId=${flowId}`);
        setRefreshTrigger(prev => prev + 1);
    }, [flowId, router, currentSessionId, messages, isLoading]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading || !flowId) return;

        const userMsg = input;
        setInput("");
        setIsLoading(true);

        // 1. Determine Session ID
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            activeSessionId = nanoid();
            setCurrentSessionId(activeSessionId);
            activeSessionIdRef.current = activeSessionId;
            // Update URL
            window.history.replaceState(null, '', `/app?flowId=${flowId}&chatId=${activeSessionId}`);
        }

        // 2. Optimistic UI Update
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);

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

            // 5. Run Flow
            await runFlow();

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

            // 7. Update UI
            setMessages(prev => {
                const updatedMessages = [...prev, { role: "assistant" as const, content: responseText }];
                sessionCacheRef.current.set(activeSessionId!, {
                    sessionId: activeSessionId!,
                    messages: updatedMessages,
                    isExecuting: false,
                });
                return updatedMessages;
            });

            // 8. Persist Response
            if (currentMessageId) {
                chatHistoryAPI.updateAssistantMessage(currentMessageId, responseText)
                    .catch(e => console.error("Failed to persist response:", e));
            }

        } catch (error) {
            console.error("Critical error in sendMessage:", error);
            if (activeSessionIdRef.current === activeSessionId) {
                setMessages(prev => [...prev, { role: "assistant", content: MESSAGES.ERROR_EXECUTION }]);
            }
        } finally {
            if (activeSessionIdRef.current === activeSessionId) {
                setIsLoading(false);
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
        sendMessage
    };
}
