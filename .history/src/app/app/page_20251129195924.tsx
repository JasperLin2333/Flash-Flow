"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { flowAPI } from "@/services/flowAPI";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import AppSidebar from "@/components/sidebar/app-sidebar";
import { nanoid } from "nanoid";

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
    sessionId: string;
    messages: { role: "user" | "assistant"; content: string }[];
    isExecuting: boolean; // 是否正在执行工作流
}

function AppContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const flowId = searchParams.get("flowId");
    const urlSessionId = searchParams.get("chatId"); // URL param 'chatId' now represents 'sessionId'

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
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 会话缓存：保存每个对话的完整状态（包括执行状态）
    const sessionCacheRef = useRef<Map<string, ChatSession>>(new Map());
    // 防止重复加载
    const isLoadingHistoryRef = useRef(false);
    // Ref to store the current message ID for updating the response later
    const currentMessageIdRef = useRef<string | null>(null);

    /**
     * 新建对话：完全清空当前对话状态
     */
    const handleNewConversation = useCallback(() => {
        // 保存当前会话到缓存
        if (currentSessionId && messages.length > 0) {
            sessionCacheRef.current.set(currentSessionId, {
                sessionId: currentSessionId,
                messages: [...messages],
                isExecuting: isLoading,
            });
        }

        // 清空当前状态
        setMessages([]);
        setInput("");
        setCurrentSessionId(null);
        setIsLoading(false);
        currentMessageIdRef.current = null;

        // 导航到干净的URL
        router.push(`/app?flowId=${flowId}`);
        setRefreshTrigger(prev => prev + 1);
    }, [flowId, router, currentSessionId, messages, isLoading]);

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
     * 加载指定会话记录到主界面
     * 优先从缓存加载，缓存未命中才从数据库加载
     */
    const loadChatHistory = useCallback(async (sessionId: string, skipUrlUpdate: boolean = false) => {
        if (!flowId || isLoadingHistoryRef.current) return;

        try {
            isLoadingHistoryRef.current = true;

            // 1. 优先检查缓存
            const cachedSession = sessionCacheRef.current.get(sessionId);
            if (cachedSession) {
                console.log(`[LoadChat] 从缓存恢复会话: ${sessionId}`, cachedSession);
                setMessages(cachedSession.messages);
                setCurrentSessionId(sessionId);
                setIsLoading(cachedSession.isExecuting);

                if (!skipUrlUpdate) {
                    router.push(`/app?flowId=${flowId}&chatId=${sessionId}`);
                }
                return;
            }

            // 2. 缓存未命中，从数据库加载
            // NOTE: 这里改为获取 Session 的所有消息
            const history = await chatHistoryAPI.getSessionMessages(sessionId);

            if (!history || history.length === 0) {
                console.warn(`Session record not found or empty: ${sessionId}`);
                // 尝试作为旧版 Message ID 加载 (Fallback for backward compatibility)
                // 如果 sessionId 实际上是一个 message ID，getSessionMessages 可能返回空
                // 这里可以做一个 fallback，但为了代码整洁，建议用户迁移数据。
                // 暂时如果找不到，就当做新会话或者空会话
                return;
            }

            console.log(`[LoadChat] 从数据库加载会话: ${sessionId}`, history);

            // 3. 重建对话历史 (Flatten the history records)
            const msgs: { role: "user" | "assistant"; content: string }[] = [];

            history.forEach(record => {
                msgs.push({ role: "user", content: record.user_message });
                if (record.assistant_message) {
                    msgs.push({ role: "assistant", content: record.assistant_message });
                }
            });

            setMessages(msgs);
            setCurrentSessionId(sessionId);
            setIsLoading(false); // 历史记录加载完默认是非执行状态

            // 4. 更新缓存
            sessionCacheRef.current.set(sessionId, {
                sessionId: sessionId,
                messages: msgs,
                isExecuting: false,
            });

            // 5. 更新URL
            if (!skipUrlUpdate) {
                router.push(`/app?flowId=${flowId}&chatId=${sessionId}`);
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
        if (urlSessionId && flowId) {
            // 如果当前已经在显示这个session，就不重新加载
            if (urlSessionId === currentSessionId) return;

            console.log(`[Effect] URL chatId changed to: ${urlSessionId}`);
            loadChatHistory(urlSessionId, true);
        } else if (!urlSessionId && currentSessionId) {
            // URL中没有chatId但state中有，说明是新建对话，需要清空
            console.log(`[Effect] No chatId in URL, clearing state`);
            setMessages([]);
            setCurrentSessionId(null);
            setIsLoading(false);
            currentMessageIdRef.current = null;
        }
    }, [urlSessionId, flowId, loadChatHistory, currentSessionId]);

    // 自动滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // 处理流程执行完成
    useEffect(() => {
        // Guard: 只处理正在加载且有会话ID的情况
        if (!isLoading || !currentSessionId) return;

        if (executionStatus === "completed") {
            console.log(`[Execution] Completed for session: ${currentSessionId}`);
            setIsLoading(false);

            // 提取流程输出
            const responseText = extractFlowOutput();
            addAssistantMessage(responseText);

            // 持久化助手回复
            if (currentMessageIdRef.current) {
                chatHistoryAPI.updateAssistantMessage(currentMessageIdRef.current, responseText);
                currentMessageIdRef.current = null; // Reset
            }

            // 更新缓存
            sessionCacheRef.current.set(currentSessionId, {
                sessionId: currentSessionId,
                messages: [...messages, { role: "assistant", content: responseText }],
                isExecuting: false,
            });

            // 刷新侧边栏
            setRefreshTrigger(prev => prev + 1);

        } else if (executionStatus === "error") {
            console.log(`[Execution] Error for session: ${currentSessionId}`);
            setIsLoading(false);

            addAssistantMessage(MESSAGES.ERROR_EXECUTION);

            if (currentMessageIdRef.current) {
                chatHistoryAPI.updateAssistantMessage(currentMessageIdRef.current, MESSAGES.ERROR_EXECUTION);
                currentMessageIdRef.current = null;
            }

            // 更新缓存
            sessionCacheRef.current.set(currentSessionId, {
                sessionId: currentSessionId,
                messages: [...messages, { role: "assistant", content: MESSAGES.ERROR_EXECUTION }],
                isExecuting: false,
            });

            setRefreshTrigger(prev => prev + 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [executionStatus, isLoading, currentSessionId]);

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

        // Step 2: 确定 Session ID
        let sessionId = currentSessionId;
        if (!sessionId) {
            sessionId = nanoid();
            setCurrentSessionId(sessionId);
            // Update URL immediately so user can refresh and stay in session
            router.push(`/app?flowId=${flowId}&chatId=${sessionId}`);
        }

        // Step 3: 持久化用户消息
        const chat = await chatHistoryAPI.addMessage(flowId, userMsg, sessionId!);
        if (chat) {
            console.log(`[Send] Created message: ${chat.id} in session: ${sessionId}`);
            currentMessageIdRef.current = chat.id; // Save ID for update

            // 立即保存到缓存（标记为正在执行）
            sessionCacheRef.current.set(sessionId!, {
                sessionId: sessionId!,
                messages: newMessages,
                isExecuting: true,
            });

            setRefreshTrigger(prev => prev + 1);
        }

        // Step 4: 更新Input节点数据
        const inputNode = nodes.find(n => n.type === "input");
        if (inputNode) {
            updateNodeData(inputNode.id, { text: userMsg });
        }

        // Step 5: 启动工作流（后台静默执行）
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

export default function AppPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AppContent />
        </Suspense>
    );
}
