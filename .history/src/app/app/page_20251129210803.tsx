"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { flowAPI } from "@/services/flowAPI";
import AppSidebar from "@/components/sidebar/app-sidebar";
import FlowAppInterface from "@/components/apps/FlowAppInterface";
import { useFlowChat } from "@/hooks/useFlowChat";

function AppContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const flowId = searchParams.get("flowId");
    const urlSessionId = searchParams.get("chatId");

    const setCurrentFlowId = useFlowStore((s) => s.setCurrentFlowId);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const setFlowTitle = useFlowStore((s) => s.setFlowTitle);
    const setFlowIcon = useFlowStore((s) => s.setFlowIcon);
    const flowIconKind = useFlowStore((s) => s.flowIconKind);
    const flowIconName = useFlowStore((s) => s.flowIconName);
    const flowIconUrl = useFlowStore((s) => s.flowIconUrl);
    const setNodes = useFlowStore((s) => s.setNodes);
    const setEdges = useFlowStore((s) => s.setEdges);

    // Use Custom Hook
    const {
        messages,
        input,
        setInput,
        isLoading,
        refreshTrigger,
        loadSession,
        clearSession,
        startNewSession,
        sendMessage
    } = useFlowChat({ flowId });

    // Sync Flow Metadata
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

    // Sync URL Chat ID
    useEffect(() => {
        if (flowId) {
            if (urlSessionId) {
                loadSession(urlSessionId);
            } else {
                clearSession();
            }
        }
    }, [urlSessionId, flowId, loadSession, clearSession]);

    return (
        <div className="h-screen w-full bg-white flex flex-col overflow-hidden">
            <AppSidebar
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
                messages={messages}
                isLoading={isLoading}
                input={input}
                onInputChange={setInput}
                onSend={sendMessage}
                onGoHome={() => router.push("/")}
            />
        </div>
    );
}

export default function AppPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AppContent />
        </Suspense>
    );
}
