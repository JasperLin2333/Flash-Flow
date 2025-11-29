"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { flowAPI } from "@/services/flowAPI";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import AppSidebar from "@/components/sidebar/app-sidebar";

import FlowAppInterface from "@/components/apps/FlowAppInterface";

// ============ Constants ============
const MESSAGES = {
    ERROR_EXECUTION: "工作流执行失败，请稍后重试。",
    EMPTY_OUTPUT: "工作流已完成，但未生成输出。",
    LOADING_HISTORY: "正在加载对话记录...",
} as const;

const OUTPUT_FIELD_PRIORITY = ["text", "response", "query"] as const;

// ============ Types ============
interface ChatSession {
    chatId: string;
    messages: { role: "user" | "assistant"; content: string }[];
    isExecuting: boolean; // 是否正在执行工作流
}

export default function AppPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const flowId = searchParams.get("flowId");
    const chatId = searchParams.get("chatId"); // 从URL读取当前对话ID

    const runFlow = useFlowStore((s) => s.runFlow);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const nodes = useFlowStore((s) => s.nodes);
    const setNodes = useFlowStore((s) => s.setNodes);
    const setEdges = useFlowStore((s) => s.setEdges);
    const setCurrentFlowId = useFlowStore((s) => s.setCurrentFlowId);
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
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 会话缓存：保存每个对话的完整状态（包括执行状态）
    const sessionCacheRef = useRef<Map<string, ChatSession>>(new Map());
    // 防止重复加载
    const isLoadingHistoryRef = useRef(false);

    /**
     * 新建对话：完全清空当前对话状态
     */
    const handleNewConversation = useCallback(() => {
        // 保存当前会话到缓存
        if (currentChatId && messages.length > 0) {
            sessionCacheRef.current.set(currentChatId, {
                chatId: currentChatId,
                messages: [...messages],
                isExecuting: isLoading,
            });
        }

        // 清空当前状态
        setMessages([]);
        setInput("");
        setCurrentChatId(null);
        setIsLoading(false);

        // 导航到干净的URL
        router.push(`/app?flowId=${flowId}`);
        setRefreshTrigger(prev => prev + 1);
    }, [flowId, router, currentChatId, messages, isLoading]);

    // ============ Helper Functions ============

    /**
     * 从节点输出数据中提取文本内容
     * 按优先级提取：text > response > query > JSON字符串
     */
    const extractTextFromOutput = (data: Record<string, unknown> | undefined): string => {
        if (!data || typeof data !== 'object') return '';

        // 按优先级顺序检查字段
        for (const field of OUTPUT_FIELD_PRIORITY) {
            const value = data[field];
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }

        // 兜底：返回JSON格式（如果对象不为空）
        return Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
    };

    /**
     * 查找并提取流程输出内容
     * 优先使用Output节点，降级到最后一个有输出的节点
     */
    const extractFlowOutput = (): string => {
        // 优先：查找Output节点
        const outputNode = nodes.find(n => n.type === "output");
        if (outputNode) {
            const outData = flowContext[outputNode.id] as Record<string, unknown> | undefined;
            const text = extractTextFromOutput(outData);
            if (text) return text;
        }

        // 降级：查找最后一个有输出的节点
        const lastNodeId = Object.keys(flowContext)
            .filter(id => flowContext[id])
            .pop();

        if (lastNodeId) {
            const outData = flowContext[lastNodeId] as Record<string, unknown> | undefined;
            const text = extractTextFromOutput(outData);
            if (text) return text;
        }

        return MESSAGES.EMPTY_OUTPUT;
    };

    /**
     * 添加助手消息到界面
     */
    const addAssistantMessage = (content: string) => {
        setMessages(prev => [...prev, { role: "assistant", content }]);
    };

    // ============ Event Handlers ============

    /**
     * 加载指定聊天记录到主界面
     * 优先从缓存加载，缓存未命中才从数据库加载
     */
    const loadChatHistory = useCallback(async (loadChatId: string, skipUrlUpdate: boolean = false) => {
        if (!flowId || isLoadingHistoryRef.current) return;

        try {
            isLoadingHistoryRef.current = true;

            // 1. 优先检查缓存
            const cachedSession = sessionCacheRef.current.get(loadChatId);
            if (cachedSession) {
                console.log(`[LoadChat] 从缓存恢复会话: ${loadChatId}`, cachedSession);
                setMessages(cachedSession.messages);
                setCurrentChatId(loadChatId);
                setIsLoading(cachedSession.isExecuting);

                if (!skipUrlUpdate) {
                    router.push(`/app?flowId=${flowId}&chatId=${loadChatId}`);
                }
                return;
            }

            // 2. 缓存未命中，从数据库加载
            const history = await chatHistoryAPI.getHistory(flowId);
            const targetChat = history.find(chat => chat.id === loadChatId);

            if (!targetChat) {
                console.warn(`Chat record not found: ${loadChatId}`);
                return;
            }

            console.log(`[LoadChat] 从数据库加载会话: ${loadChatId}`, targetChat);

            // 3. 重建对话历史
            const msgs: { role: "user" | "assistant"; content: string }[] = [
                { role: "user", content: targetChat.user_message }
            ];

            // 如果有助手回复，说明已完成
            const hasResponse = !!targetChat.assistant_message;
            if (hasResponse && targetChat.assistant_message) {
                msgs.push({ role: "assistant", content: targetChat.assistant_message });
            }

            setMessages(msgs);
            setCurrentChatId(loadChatId);
            // 数据库中有回复 = 已完成，无回复 = 可能执行失败或被中断，都设为false
            setIsLoading(false);

            // 4. 更新缓存
            sessionCacheRef.current.set(loadChatId, {
                chatId: loadChatId,
                messages: msgs,
                isExecuting: false,
            });

            // 5. 更新URL
            if (!skipUrlUpdate) {
                router.push(`/app?flowId=${flowId}&chatId=${loadChatId}`);
            }
        } catch (error) {
            console.error("Failed to load chat history:", error);
        } finally {
            isLoadingHistoryRef.current = false;
        }
    }, [flowId, router]);

    // 加载Flow元数据（只在flowId变化时执行一次）
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

    // 当URL中chatId变化时，加载对应的对话
    useEffect(() => {
        if (chatId && flowId) {
            console.log(`[Effect] URL chatId changed to: ${chatId}`);
            loadChatHistory(chatId, true);
        } else if (!chatId && currentChatId) {
            // URL中没有chatId但state中有，说明是新建对话，需要清空
            console.log(`[Effect] No chatId in URL, clearing state`);
            setMessages([]);
            setCurrentChatId(null);
            setIsLoading(false);
        }
    }, [chatId, flowId, loadChatHistory, currentChatId]);

    // 自动滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // 处理流程执行完成
    useEffect(() => {
        // Guard: 只处理正在加载且有会话ID的情况
        if (!isLoading || !currentChatId) return;

        if (executionStatus === "completed") {
            console.log(`[Execution] Completed for chat: ${currentChatId}`);
            setIsLoading(false);

            // 提取流程输出
            const responseText = extractFlowOutput();
            addAssistantMessage(responseText);

            // 持久化助手回复
            chatHistoryAPI.updateAssistantMessage(currentChatId, responseText);

            // 更新缓存
            sessionCacheRef.current.set(currentChatId, {
                chatId: currentChatId,
                messages: [...messages, { role: "assistant", content: responseText }],
                isExecuting: false,
            });

            // 刷新侧边栏
            setRefreshTrigger(prev => prev + 1);

        } else if (executionStatus === "error") {
            console.log(`[Execution] Error for chat: ${currentChatId}`);
            setIsLoading(false);

            addAssistantMessage(MESSAGES.ERROR_EXECUTION);

            // 记录错误到数据库
            chatHistoryAPI.updateAssistantMessage(currentChatId, MESSAGES.ERROR_EXECUTION);

            // 更新缓存
            sessionCacheRef.current.set(currentChatId, {
                chatId: currentChatId,
                messages: [...messages, { role: "assistant", content: MESSAGES.ERROR_EXECUTION }],
                isExecuting: false,
            });

            setRefreshTrigger(prev => prev + 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [executionStatus, isLoading, currentChatId]); // extractFlowOutput依赖nodes和flowContext，但为了避免过度渲染，仅监听关键状态

    const handleSend = async () => {
        // Guard: 防止重复提交或空消息
        if (!input.trim() || isLoading) return;
        if (!flowId) {
            console.error("No flowId found");
            return;
        }

        const userMsg = input;

        // Step 1: 消息上屏 & 锁定输入框
        setInput("");
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);
        setIsLoading(true);

        // Step 2: 持久化用户消息
        const chat = await chatHistoryAPI.addMessage(flowId, userMsg);
        if (chat) {
            console.log(`[Send] Created chat: ${chat.id}`);
            setCurrentChatId(chat.id);

            // 立即保存到缓存（标记为正在执行）
            sessionCacheRef.current.set(chat.id, {
                chatId: chat.id,
                messages: newMessages,
                isExecuting: true,
            });

            // 更新URL以保存当前对话ID
            router.push(`/app?flowId=${flowId}&chatId=${chat.id}`);
            setRefreshTrigger(prev => prev + 1);
        }

        // Step 3: 更新Input节点数据
        const inputNode = nodes.find(n => n.type === "input");
        if (inputNode) {
            updateNodeData(inputNode.id, { text: userMsg });
        }

        // Step 4: 启动工作流（后台静默执行）
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
