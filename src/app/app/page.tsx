"use client";
import { useEffect, Suspense, useMemo, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { flowAPI } from "@/services/flowAPI";
import AppSidebar, { APP_SIDEBAR_WIDTH } from "@/components/sidebar/app-sidebar";
import FlowAppInterface from "@/components/apps/FlowAppInterface";
import { useFlowChat } from "@/hooks/useFlowChat";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function AppContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const flowId = searchParams.get("flowId");
    const urlSessionId = searchParams.get("chatId");

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

    const setCurrentFlowId = useFlowStore((s) => s.setCurrentFlowId);
    const currentFlowId = useFlowStore((s) => s.currentFlowId);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const setFlowTitle = useFlowStore((s) => s.setFlowTitle);
    const setFlowIcon = useFlowStore((s) => s.setFlowIcon);
    const flowIconKind = useFlowStore((s) => s.flowIconKind);
    const flowIconName = useFlowStore((s) => s.flowIconName);
    const flowIconUrl = useFlowStore((s) => s.flowIconUrl);
    const setNodes = useFlowStore((s) => s.setNodes);
    const setEdges = useFlowStore((s) => s.setEdges);

    const {
        messages,
        input,
        setInput,
        isLoading,
        refreshTrigger,
        loadSession,
        startNewSession,
        sendMessage,
        streamingText,
        isStreaming,
    } = useFlowChat({ flowId });

    const initializedFlowIdRef = useRef<string | null>(null);

    // 初始化流程：加载 Flow 数据和 Chat 历史
    useEffect(() => {
        if (!flowId) {
            setIsInitializing(false);
            return;
        }

        // 当 currentFlowId 与 URL 的 flowId 不匹配时，加载数据
        const needsDataLoad = currentFlowId !== flowId;

        if (needsDataLoad) {
            setIsInitializing(true);
            initializedFlowIdRef.current = flowId;
        }

        let mounted = true;

        (async () => {
            try {
                if (needsDataLoad) {
                    const flow = await flowAPI.getFlow(flowId);
                    if (!mounted) return;

                    if (flow) {
                        setCurrentFlowId(flowId);
                        setFlowTitle(flow.name);
                        setFlowIcon(flow.icon_kind, flow.icon_name, flow.icon_url);
                        setNodes(flow.data.nodes || []);
                        setEdges(flow.data.edges || []);
                    }
                }

                if (urlSessionId) {
                    await loadSession(urlSessionId);
                }
            } catch (err) {
                console.error("Failed to initialize app:", err);
            } finally {
                if (mounted) {
                    setIsInitializing(false);
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, [flowId, urlSessionId, currentFlowId, setCurrentFlowId, setFlowTitle, setFlowIcon, setNodes, setEdges, loadSession]);

    // Use a ref to store a stable timestamp for the CURRENT streaming session
    const streamingStartTimeRef = useRef<Date | null>(null);

    // Compute display messages: append streaming text as partial assistant message
    // 当有流式输出时，将其作为临时助手消息显示
    const { displayMessages, shouldShowLoading } = useMemo(() => {
        if (isStreaming && streamingText) {
            if (!streamingStartTimeRef.current) {
                streamingStartTimeRef.current = new Date();
            }
            return {
                displayMessages: [...messages, { role: "assistant" as const, content: streamingText, timestamp: streamingStartTimeRef.current }],
                shouldShowLoading: false // 流式输出时不显示loading
            };
        }

        // Reset stable timestamp when not streaming
        if (!isStreaming && streamingStartTimeRef.current) {
            streamingStartTimeRef.current = null;
        }

        // 如果最后一条消息是用户消息，且正在loading，说明正在等待AI回复
        const lastMessage = messages[messages.length - 1];
        const isWaitingForResponse = isLoading && lastMessage?.role === "user";

        return {
            displayMessages: messages,
            shouldShowLoading: isWaitingForResponse // 只有在等待回复时显示loading
        };
    }, [messages, isStreaming, streamingText, isLoading]);

    // 等待数据加载完成
    if (isInitializing) {
        return null;
    }

    // 防止显示错误的 flow 数据
    if (currentFlowId && flowId && currentFlowId !== flowId) {
        return null;
    }

    return (
        <div className="h-screen w-full bg-white flex flex-col overflow-hidden">
            <AppSidebar
                isOpen={sidebarOpen}
                onToggle={setSidebarOpen}
                currentFlowId={flowId || undefined}
                onRefreshTrigger={refreshTrigger}
                onNewConversation={startNewSession}
                onLoadChat={loadSession}
            />

            <FlowAppInterface
                flowTitle={flowTitle}
                flowIcon={{
                    kind: flowIconKind,
                    name: flowIconName,
                    url: flowIconUrl
                }}
                messages={displayMessages}
                isLoading={shouldShowLoading}
                isStreaming={isStreaming} // 新增
                input={input}
                onInputChange={setInput}
                onSend={sendMessage}
                onGoHome={() => router.push("/")}
                onNewConversation={startNewSession}
                sidebarOffset={sidebarOpen ? APP_SIDEBAR_WIDTH : 0}
            />
        </div>
    );
}

// 统一的加载组件
function LoadingScreen() {
    return (
        <div className="h-screen w-full bg-white flex items-center justify-center">
            <div className="text-gray-400">加载中...</div>
        </div>
    );
}

export default function AppPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <ProtectedRoute>
                <AppContent />
            </ProtectedRoute>
        </Suspense>
    );
}
