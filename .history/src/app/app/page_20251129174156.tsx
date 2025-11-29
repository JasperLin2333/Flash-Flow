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
                console.log(`[AppPage] URL chatId changed to: ${chatId}`);
                loadChatHistory(chatId, true);
            }
        } else if (!chatId && currentChatId) {
            // URL has no chatId but state does -> New Conversation
            console.log(`[AppPage] No chatId in URL, clearing state`);
            startNewConversation();
        }
    }, [chatId, flowId, currentChatId, loadChatHistory, startNewConversation]);

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

        try {
            // 1. Create Chat Record (if needed) or Append Message
            // Note: If we already have a chatId, we just append. If not, we create new.
            // But for consistency with legacy logic, we always call addMessage which handles both?
            // Actually legacy logic always called addMessage(flowId, msg). 
            // Let's check chatHistoryAPI.addMessage signature.
            // It takes (flowId, message). It creates a NEW chat every time? 
            // Wait, legacy logic: const chat = await chatHistoryAPI.addMessage(flowId, userMsg);
            // This implies it creates a NEW chat session for every first message?
            // Yes, if currentChatId is null.
            // But if we are IN a chat, we should probably append to it?
            // The legacy logic:
            // const chat = await chatHistoryAPI.addMessage(flowId, userMsg);
            // setCurrentChatId(chat.id);
            // It seems the API creates a new chat record. 
            // If we are continuing a conversation, we should probably use a different API or the API handles it?
            // Looking at legacy code: It ALWAYS called addMessage(flowId, userMsg).
            // And then set currentChatId to the result.
            // This implies that "sending a message" in this app context might always start a NEW flow execution context?
            // OR the API is smart enough?
            // Let's look at legacy again:
            // const chat = await chatHistoryAPI.addMessage(flowId, userMsg);
            // if (chat) { setCurrentChatId(chat.id); ... }
            // This suggests it creates a new record.
            // However, if we are in an existing chat, shouldn't we append?
            // The legacy code didn't seem to have "append to existing chat" logic for the USER message persistence, 
            // it only persisted the ASSISTANT message to the *just created* chat.
            // Wait, if I am in chat A, and I send a message, does it create Chat B?
            // Legacy code:
            // handleSend -> chatHistoryAPI.addMessage(flowId, userMsg) -> returns new chat?
            // If so, every message starts a new conversation thread?
            // That seems odd for a "Chat" app, but maybe it's a "Flow Runner" where every run is a session.
            // Let's assume for now we follow the legacy behavior: Create a new chat record for every run.
            // BUT, if the user wants to "continue" a chat?
            // The legacy code didn't seem to support "continuing" a chat in the sense of multi-turn conversation *with the backend*.
            // It just loaded history.
            // If I am in history view of Chat A, and I send a message...
            // Legacy code: `handleSend` uses `flowId` and `input`. It does NOT use `currentChatId` to append.
            // It calls `addMessage(flowId, userMsg)`.
            // So YES, it creates a NEW session every time you click send.
            // This effectively means "Forking" or "Restarting" if you are in an old chat.
            // I will maintain this behavior for now to ensure "functionality consistency".

            const userMsg = { role: "user" as const, content: userMsgContent };

            // Optimistic Update (Temporary, will be replaced by initChatSession)
            // Actually, we shouldn't update messages yet if we are going to switch chatId.
            // But we want to show the user message immediately.

            // 1. Persist User Message (Creates new chat session)
            const chat = await chatHistoryAPI.addMessage(flowId, userMsgContent);

            if (chat) {
                console.log(`[AppPage] Created chat session: ${chat.id}`);

                // 2. Initialize Session
                initChatSession(chat.id, [userMsg]);
                setRefreshTrigger(prev => prev + 1);

                // 3. Execute Flow
                await executeFlow(userMsgContent, chat.id);
            }

        } catch (error) {
            console.error("Failed to send message:", error);
            // Restore input if failed?
            setInput(userMsgContent);
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
