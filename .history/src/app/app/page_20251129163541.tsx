"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { flowAPI } from "@/services/flowAPI";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import AppSidebar from "@/components/sidebar/app-sidebar";

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
    const [refreshTrigger, setRefreshTrigger] = useState(0); // 用于触发侧边栏刷新
    const scrollRef = useRef<HTMLDivElement>(null);

    // 新建对话：重置对话状态
    const handleNewConversation = () => {
        // 防御性重置：清空所有会话相关状态
        setMessages([]);
        setInput("");
        setCurrentChatId(null);
        setIsLoading(false);
        // 触发侧边栏刷新，确保历史记录列表更新
        setRefreshTrigger(prev => prev + 1);
    };

    // 提取文本的辅助函数 (纯函数，移出 useEffect 以避免依赖问题)
    const extractTextFromOutput = (data: Record<string, unknown> | undefined): string => {
        if (!data || typeof data !== 'object') return '';

        // 优先顺序：text > response > query
        if (typeof data.text === 'string' && data.text.trim()) return data.text;
        if (typeof data.response === 'string' && data.response.trim()) return data.response;
        if (typeof data.query === 'string' && data.query.trim()) return data.query;

        // 兜底：如果对象不为空，返回 JSON 字符串
        return Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
    };

    /**
     * 加载指定聊天记录到主界面
     * @param chatId - 聊天记录ID
     */
    const loadChatHistory = async (chatId: string) => {
        if (!flowId) return;

        try {
            const history = await chatHistoryAPI.getHistory(flowId);
            const targetChat = history.find(chat => chat.id === chatId);

            if (targetChat) {
                // 加载该条聊天的完整对话
                const msgs: typeof messages = [
                    { role: "user", content: targetChat.user_message }
                ];
                if (targetChat.assistant_message) {
                    msgs.push({ role: "assistant", content: targetChat.assistant_message });
                }
                setMessages(msgs);
                setCurrentChatId(chatId);
            }
        } catch (error) {
            console.error("Failed to load chat history:", error);
        }
    };

    // Load flow data and initial chat history
    useEffect(() => {
        if (!flowId) return;

        // 加载Flow元数据
        flowAPI.getFlow(flowId).then((flow) => {
            if (flow) {
                setFlowTitle(flow.name);
                setFlowIcon(flow.icon_kind, flow.icon_name, flow.icon_url);
                setNodes(flow.data.nodes || []);
                setEdges(flow.data.edges || []);
            }
        });

        // FIX: 移除了自动加载所有历史记录的逻辑
        // 页面初始化时应该保持空白，等待用户新建对话或选择历史记录
    }, [flowId]); // 移除 currentChatId 依赖，防止意外重载

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Handle flow completion
    useEffect(() => {
        // Guard Clause: 只有在 loading 且有 chatId 时才处理完成状态
        if (!isLoading || !currentChatId) return;

        if (executionStatus === "completed") {
            setIsLoading(false);

            const outputNode = nodes.find(n => n.type === "output");
            let responseText = '';

            if (outputNode) {
                const outData = flowContext[outputNode.id] as Record<string, unknown> | undefined;
                responseText = extractTextFromOutput(outData);
            } else {
                // Fallback: 查找最后一个有输出的节点
                const lastNodeId = Object.keys(flowContext).filter(id => flowContext[id]).pop();
                if (lastNodeId) {
                    const outData = flowContext[lastNodeId] as Record<string, unknown> | undefined;
                    responseText = extractTextFromOutput(outData);
                }
            }

            // FIX: 确保不显示 undefined
            const finalText = responseText || "工作流已完成，但未生成输出。";
            setMessages(prev => [...prev, { role: "assistant", content: finalText }]);

            // Save assistant message
            // FIX: 不再重置 currentChatId，保持在当前会话中
            chatHistoryAPI.updateAssistantMessage(currentChatId, finalText);

            // 刷新侧边栏历史记录 (更新摘要等)
            setRefreshTrigger(prev => prev + 1);

        } else if (executionStatus === "error") {
            setIsLoading(false);
            const errorMsg = "Error executing flow.";
            setMessages(prev => [...prev, { role: "assistant", content: errorMsg }]);

            chatHistoryAPI.updateAssistantMessage(currentChatId, errorMsg);
            // 保持在当前会话，不重置 ID

            setRefreshTrigger(prev => prev + 1);
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
            // 刷新侧边栏历史记录
            setRefreshTrigger(prev => prev + 1);
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
