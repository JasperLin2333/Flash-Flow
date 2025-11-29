"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { flowAPI } from "@/services/flowAPI";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import SidebarDrawer from "@/components/ui/sidebar-drawer";

import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import FlowAppInterface from "@/components/apps/FlowAppInterface";

export default function AppPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const flowId = searchParams.get("flowId");

    const runFlow = useFlowStore((s) => s.runFlow);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const nodes = useFlowStore((s) => s.nodes);
    const setNodes = useFlowStore((s) => s.setNodes);
    const setEdges = useFlowStore((s) => s.setEdges);
    const executionStatus = useFlowStore((s) => s.executionStatus);
    const flowContext = useFlowStore((s) => s.flowContext);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const setFlowTitle = useFlowStore((s) => s.setFlowTitle);
    const setFlowIcon = useFlowStore((s) => s.setFlowIcon);
    const flowIconKind = useFlowStore((s) => s.flowIconKind);
    const flowIconName = useFlowStore((s) => s.flowIconName);
    const flowIconUrl = useFlowStore((s) => s.flowIconUrl);

    const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load flow data
    useEffect(() => {
        if (flowId) {
            flowAPI.getFlow(flowId).then((flow) => {
                if (flow) {
                    setFlowTitle(flow.name);
                    setFlowIcon(flow.icon_kind, flow.icon_name, flow.icon_url);
                    setNodes(flow.data.nodes || []);
                    setEdges(flow.data.edges || []);
                }
            });

            // Load chat history
            chatHistoryAPI.getHistory(flowId).then((history) => {
                const msgs: typeof messages = [];
                history.forEach(chat => {
                    msgs.push({ role: "user", content: chat.user_message });
                    if (chat.assistant_message) {
                        msgs.push({ role: "assistant", content: chat.assistant_message });
                    }
                });
                setMessages(msgs);
            });
        }
    }, [flowId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Handle flow completion
    useEffect(() => {
        if (executionStatus === "completed" && isLoading && currentChatId) {
            setIsLoading(false);

            // FIX: Safe output extraction with proper type guards
            const extractText = (data: Record<string, unknown> | undefined): string => {
                if (!data || typeof data !== 'object') return '';

                // Try to extract in priority order
                if (typeof data.text === 'string' && data.text.trim()) return data.text;
                if (typeof data.response === 'string' && data.response.trim()) return data.response;
                if (typeof data.query === 'string' && data.query.trim()) return data.query;

                // FIX: Avoid JSON.stringify(undefined) returning "undefined"
                return Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
            };

            const outputNode = nodes.find(n => n.type === "output");
            let responseText = '';

            if (outputNode) {
                const outData = flowContext[outputNode.id] as Record<string, unknown> | undefined;
                responseText = extractText(outData);
            } else {
                // FIX: Safe last node lookup
                const lastNodeId = Object.keys(flowContext).filter(id => flowContext[id]).pop();
                if (lastNodeId) {
                    const outData = flowContext[lastNodeId] as Record<string, unknown> | undefined;
                    responseText = extractText(outData);
                }
            }

            // FIX: Ensure we never store empty or undefined text
            const finalText = responseText || "工作流已完成，但未生成输出。";
            setMessages(prev => [...prev, { role: "assistant", content: finalText }]);

            // Save assistant message
            chatHistoryAPI.updateAssistantMessage(currentChatId, finalText);
            setCurrentChatId(null);
        } else if (executionStatus === "error" && isLoading && currentChatId) {
            setIsLoading(false);
            setMessages(prev => [...prev, { role: "assistant", content: "Error executing flow." }]);
            chatHistoryAPI.updateAssistantMessage(currentChatId, "Error executing flow.");
            setCurrentChatId(null);
        }
    }, [executionStatus, flowContext, nodes, isLoading, currentChatId]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        if (!flowId) {
            console.error("No flowId found");
            return;
        }

        const userMsg = input;
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setIsLoading(true);

        // Save to chat history
        const chat = await chatHistoryAPI.addMessage(flowId, userMsg);
        if (chat) {
            setCurrentChatId(chat.id);
        }

        // Update Input Node
        const inputNode = nodes.find(n => n.type === "input");
        if (inputNode) {
            updateNodeData(inputNode.id, { text: userMsg });
        }

        // Run Flow
        await runFlow();
    };

    return (
        <div className="h-screen w-full bg-white flex flex-col overflow-hidden">
            <SidebarDrawer variant="app" hideTopIcons currentFlowId={flowId || undefined} />

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
