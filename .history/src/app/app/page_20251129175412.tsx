"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { flowAPI } from "@/services/flowAPI";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import AppSidebar from "@/components/sidebar/app-sidebar";
import FlowAppInterface from "@/components/apps/FlowAppInterface";
import { useChatSession } from "@/hooks/useChatSession";
import { useFlowExecution } from "@/hooks/useFlowExecution";

export default function AppPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const flowId = searchParams.get("flowId");
    const chatId = searchParams.get("chatId");

    // Store State
    const setNodes = useFlowStore((s) => s.setNodes);
    const setEdges = useFlowStore((s) => s.setEdges);
    const setCurrentFlowId = useFlowStore((s) => s.setCurrentFlowId);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const setFlowTitle = useFlowStore((s) => s.setFlowTitle);
    const setFlowIcon = useFlowStore((s) => s.setFlowIcon);
    const flowIconKind = useFlowStore((s) => s.flowIconKind);
    const flowIconName = useFlowStore((s) => s.flowIconName);
    const flowIconUrl = useFlowStore((s) => s.flowIconUrl);

    // Local UI State
    const [input, setInput] = useState("");
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Custom Hooks
    const {
        messages,
        currentChatId,
        isLoadingHistory,
        loadChatHistory,
        startNewConversation,
        updateMessages,
        initChatSession
    } = useChatSession({ flowId });

    const {
        isExecuting,
        executeFlow
    } = useFlowExecution({
        flowId,
        currentChatId,
        onMessageReceived: (msg) => {
            updateMessages([...messages, msg]);
        },
        onExecutionComplete: () => {
            setRefreshTrigger(prev => prev + 1);
        }
    });

    // Combined Loading State
    const isLoading = isLoadingHistory || isExecuting;

    // ============ Effects ============

    // 1. Load Flow Metadata
    useEffect(() => {
        if (!flowId) return;

        flowAPI.getFlow(flowId).then((flow) => {
            if (flow) {
                setCurrentFlowId(flowId);
                setFlowTitle(flow.name);
                setFlowIcon(flow.icon_kind, flow.icon_name, flow.icon_url);
                setNodes(flow.data.nodes || []);
                setEdges(flow.data.edges || []);
            }
        });
    }, [flowId, setCurrentFlowId, setFlowTitle, setFlowIcon, setNodes, setEdges]);

    // 2. Handle URL chatId changes
    useEffect(() => {
        if (chatId && flowId) {
            // If URL has chatId, load it (unless it's the one we just created)
            if (chatId !== currentChatId) {
                console.log(`[AppPage] URL chatId changed to: ${chatId}, current is: ${currentChatId}`);
                loadChatHistory(chatId, true);
            } else {
                console.log(`[AppPage] URL chatId matches current, skipping load: ${chatId}`);
            }
        } else if (!chatId && currentChatId) {
            // URL has no chatId but state does -> New Conversation
            // Only if we are NOT currently executing (to prevent clearing state if URL update lags)
            if (!isExecuting) {
                console.log(`[AppPage] No chatId in URL, clearing state`);
                startNewConversation();
            }
        }
    }, [chatId, flowId, currentChatId, loadChatHistory, startNewConversation, isExecuting]);

    // 3. Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // ============ Handlers ============

    const handleNewConversation = useCallback(() => {
        startNewConversation();
        setRefreshTrigger(prev => prev + 1);
    }, [startNewConversation]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || !flowId) return;

        const userMsgContent = input;
        setInput(""); // Optimistic clear

        // Optimistic Update: Show message immediately
        const userMsg = { role: "user" as const, content: userMsgContent };
        const newMessages = [...messages, userMsg];
        updateMessages(newMessages);

        try {
            // 1. Create Chat Record (if needed) or Append Message
            // Note: Legacy behavior creates a NEW chat record for every "Send" if we follow the old pattern.
            // However, to support "continuing" a chat, we should ideally check if we are in a valid chat.
            // But the API `addMessage` always returns a new record? Let's assume it does.
            // Wait, if `addMessage` creates a NEW record, then we are effectively starting a new session.
            // If we want to append, we need to know if the backend supports it.
            // Assuming `addMessage` creates a new row in `chat_history` table.

            const chat = await chatHistoryAPI.addMessage(flowId, userMsgContent);

            if (chat) {
                console.log(`[AppPage] Created chat session: ${chat.id}`);

                // 2. Initialize Session (updates chatId and URL)
                // IMPORTANT: This will trigger the URL update.
                // We pass the messages we already have (plus potentially any ID updates if needed)
                initChatSession(chat.id, newMessages);
                setRefreshTrigger(prev => prev + 1);

                // 3. Execute Flow
                await executeFlow(userMsgContent, chat.id);
            } else {
                console.error("[AppPage] Failed to create chat record");
                // Revert optimistic update?
                // For now, let's just leave it or show error
            }

        } catch (error) {
            console.error("Failed to send message:", error);
            setInput(userMsgContent); // Restore input
            // TODO: Toast error
        }
    };

    return (
        <div className="h-screen w-full bg-white flex flex-col overflow-hidden">
            <AppSidebar
                currentFlowId={flowId || undefined}
                onRefreshTrigger={refreshTrigger}
                onNewConversation={handleNewConversation}
                onLoadChat={loadChatHistory}
            />

            <FlowAppInterface
                flowTitle={flowTitle}
                flowIcon={{
                    kind: flowIconKind,
                    name: flowIconName,
                    url: flowIconUrl
                }}
                messages={messages}
                isLoading={isLoading}
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
                onGoHome={() => router.push("/")}
            />
        </div>
    );
}
