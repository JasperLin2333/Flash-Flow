"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import type { ChatHistory } from "@/services/chatHistoryAPI";
import { AccountManager, formatTime, SIDEBAR_COLORS, SIDEBAR_SIZES } from "./sidebar-shared";

// Sidebar width constant - exported for layout calculations
export const APP_SIDEBAR_WIDTH = 280;

interface AppSidebarProps {
    isOpen: boolean;
    onToggle: (open: boolean) => void;
    currentFlowId?: string;
    onRefreshTrigger?: number;
    onLoadChat?: (chatId: string) => void;
}

/**
 * AppSidebar - App 页面侧边栏组件 (Persistent Panel)
 * 
 * 功能：
 * 1. 导航返回：Flowbox 跳转按钮（作为返回键）
 * 2. 当前 Flow 使用记录：显示该 App 下的历史对话
 * 3. 展示元素：用户发送的第一条消息作为标题
 * 4. 排序逻辑：创建时间倒序（最新的对话在最上面）
 * 5. 分组：今天、昨天
 * 6. 底部账号管理
 * 
 * 改进：持久化展开，无遮罩，作为页面布局的一部分
 */
export default function AppSidebar({
    isOpen,
    onToggle,
    currentFlowId,
    onRefreshTrigger,
    onLoadChat
}: AppSidebarProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [chatHistory, setChatHistory] = useState<{ id: string; title: string; created_at: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // 加载当前 Flow 的聊天历史
    useEffect(() => {
        if (currentFlowId) {
            // 只有首次加载时显示 loading（chatHistory 为空），后续刷新静默更新
            const isFirstLoad = chatHistory.length === 0;
            if (isFirstLoad) {
                setLoading(true);
            }

            chatHistoryAPI.getHistory(currentFlowId).then((data: ChatHistory[]) => {
                // Group by session_id
                const groups = new Map<string, { id: string, title: string, created_at: string }>();

                // Data is sorted by created_at ASC from API
                data.forEach((chat: ChatHistory) => {
                    // Use session_id if available, otherwise fallback to id (legacy)
                    // If session_id is present, it groups all messages of that session.
                    // If not, each message is its own group (legacy behavior).
                    const sessionId = chat.session_id || chat.id;

                    if (!groups.has(sessionId)) {
                        groups.set(sessionId, {
                            id: sessionId,
                            // Use the first message as the title
                            title: (chat.user_message || "空消息").slice(0, 50) + (chat.user_message && chat.user_message.length > 50 ? "..." : ""),
                            created_at: chat.created_at
                        });
                    } else {
                        // Update timestamp to the latest one (since we iterate ASC, later items are newer)
                        const existing = groups.get(sessionId)!;
                        existing.created_at = chat.created_at;
                    }
                });

                const mapped = Array.from(groups.values())
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setChatHistory(mapped);
                setLoading(false);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFlowId, onRefreshTrigger]);

    // 按创建时间倒序排列的对话列表
    const filteredChats = chatHistory.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <>
            {/* Toggle Button - Only visible when sidebar is closed */}
            {!isOpen && (
                <Button
                    onClick={() => onToggle(true)}
                    className="fixed top-20 left-8 z-50 rounded-full bg-black text-white hover:bg-black/90 active:bg-black/95 shadow-md font-semibold transition-all duration-150 w-10 h-10 p-0 flex items-center justify-center"
                    aria-label="历史记录"
                    title="历史记录"
                >
                    <History className="w-4 h-4" />
                </Button>
            )}

            {/* Sidebar Panel - Persistent, no overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        initial={{ x: -APP_SIDEBAR_WIDTH, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -APP_SIDEBAR_WIDTH, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed top-16 left-0 h-[calc(100%-4rem)] bg-white border-r border-gray-200 shadow-lg z-40"
                        style={{ width: APP_SIDEBAR_WIDTH }}
                    >
                        <div className="h-full flex flex-col relative">
                            {/* 关闭按钮：右侧垂直居中，小箭头折叠 */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white border border-l-0 border-gray-200 rounded-r-lg shadow-sm hover:bg-gray-50 z-50 flex items-center justify-center"
                                aria-label="Close Sidebar"
                                title="Close Sidebar"
                                onClick={() => onToggle(false)}
                            >
                                <ChevronDown className="w-4 h-4 text-gray-400 rotate-90" />
                            </Button>

                            {/* 历史记录列表 */}
                            <div className="flex-1 overflow-y-auto py-5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                                <div className="px-4 mb-3">
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="搜索历史记录"
                                        className="h-9 rounded-lg border-gray-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    {loading ? (
                                        <div className="text-center py-8 text-sm text-gray-400">加载中…</div>
                                    ) : filteredChats.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-gray-400">
                                            {searchQuery ? "未找到相关记录" : "还没有历史对话"}
                                        </div>
                                    ) : (
                                        filteredChats.map((chat) => (
                                            <button
                                                key={chat.id}
                                                className={`w-full h-[34px] px-4 text-left ${SIDEBAR_COLORS.bg.hover} cursor-pointer flex items-center rounded-md`}
                                                onClick={() => {
                                                    if (onLoadChat) {
                                                        onLoadChat(chat.id);
                                                    }
                                                }}
                                            >
                                                <span
                                                    className={`flex-1 min-w-0 ${SIDEBAR_SIZES.text.sm} ${SIDEBAR_COLORS.text.primary} truncate`}
                                                >
                                                    {chat.title}
                                                </span>
                                                <span
                                                    className={`flex-shrink-0 ml-3 ${SIDEBAR_SIZES.text.xs} ${SIDEBAR_COLORS.text.label} whitespace-nowrap`}
                                                >
                                                    {formatTime(chat.created_at)}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 底部账号管理 */}
                            <div className="border-t border-gray-100 px-4 py-4">
                                <AccountManager />
                            </div>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}
