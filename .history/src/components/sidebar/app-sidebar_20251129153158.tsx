"use client";

import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, VisuallyHidden } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Zap, X, ChevronDown, ArrowUpRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import type { ChatHistory } from "@/services/chatHistoryAPI";
import { AccountManager, formatTime, SIDEBAR_COLORS, SIDEBAR_SIZES } from "./sidebar-shared";

/**
 * AppSidebar - App 页面侧边栏组件
 * 
 * 功能：
 * 1. 导航返回：Flowbox 跳转按钮（作为返回键）
 * 2. 当前 Flow 使用记录：显示该 App 下的历史对话
 * 3. 展示元素：用户发送的第一条消息作为标题
 * 4. 排序逻辑：创建时间倒序（最新的对话在最上面）
 * 5. 分组：今天、昨天
 * 6. 底部账号管理
 */
export default function AppSidebar({
    currentFlowId,
    onRefreshTrigger,
    onNewConversation,
    onLoadChat
}: {
    currentFlowId?: string;
    onRefreshTrigger?: number;
    onNewConversation?: () => void;
    onLoadChat?: (chatId: string) => void;
}) {
    const router = useRouter();
    const [todayOpen, setTodayOpen] = useState(true);
    const [yesterdayOpen, setYesterdayOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [chatHistory, setChatHistory] = useState<{ id: string; title: string; created_at: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // 加载当前 Flow 的聊天历史
    useEffect(() => {
        if (currentFlowId) {
            setLoading(true);
            chatHistoryAPI.getHistory(currentFlowId).then((data: ChatHistory[]) => {
                const mapped = data
                    .map((chat: ChatHistory) => ({
                        id: chat.id,
                        // 使用用户的第一条消息作为标题
                        title: (chat.user_message || "空消息").slice(0, 50) + (chat.user_message && chat.user_message.length > 50 ? "..." : ""),
                        created_at: chat.created_at,
                    }))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setChatHistory(mapped);
                setLoading(false);
            });
        }
    }, [currentFlowId, onRefreshTrigger]);

    const filteredChats = chatHistory.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

    // 分组：今天的对话
    const todayChats = filteredChats.filter((c) => {
        const date = new Date(c.created_at);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);
        return diffHours < 24;
    });

    // 分组：昨天的对话
    const yesterdayChats = filteredChats.filter((c) => {
        const date = new Date(c.created_at);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);
        return diffHours >= 24 && diffHours < 48;
    });

    return (
        <Sheet>
            <div className="fixed top-20 left-8 flex items-center gap-2 z-50">
                <SheetTrigger asChild>
                    <Button
                        className="rounded-full bg-black text-white hover:bg-black/90 active:bg-black/95 shadow-md font-semibold transition-all duration-150 h-10 px-3 flex items-center gap-2"
                        aria-label="历史记录"
                        title="历史记录"
                    >
                        <History className="w-4 h-4" />
                        <span className="text-sm font-medium">历史记录</span>
                    </Button>
                </SheetTrigger>
                {onNewConversation && (
                    <button
                        onClick={onNewConversation}
                        className="group relative rounded-full bg-black text-white hover:bg-black/90 active:bg-black/95 shadow-md transition-all duration-150 h-10 w-10 flex items-center justify-center"
                        aria-label="新建对话"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded-md px-2 py-1 shadow-md whitespace-nowrap font-medium transition-all duration-150">
                            新建对话
                        </span>
                    </button>
                )}
            </div>

            <SheetContent side="left" className="bg-white border-r border-gray-200 p-0 shadow-lg">
                <VisuallyHidden>
                    <SheetTitle>侧边栏导航</SheetTitle>
                </VisuallyHidden>
                <div className="h-full flex flex-col">
                    {/* 顶部 Logo 和关闭按钮 */}
                    <div className="py-4 px-4 flex items-center justify-between border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-black" />
                            <div className="text-[15px] font-bold tracking-tight text-gray-900">Flash Flow</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <SheetClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="size-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                    aria-label="Close Sidebar"
                                    title="Close Sidebar"
                                >
                                    <X className="w-[18px] h-[18px]" />
                                </Button>
                            </SheetClose>
                        </div>
                    </div>

                    {/* 导航按钮 */}
                    <div className="pt-3 pb-2 px-4">
                        <div className="mt-2">
                            <Button
                                onClick={() => router.push("/flows")}
                                className="w-full h-9 rounded-lg bg-black text-white hover:bg-black/90 shadow-sm font-medium transition-all duration-150 gap-2 justify-start px-3"
                            >
                                <Zap className="w-4 h-4" />
                                Flow Box
                                <ArrowUpRight className="w-4 h-4 ml-auto" />
                            </Button>
                        </div>
                    </div>
                    <Separator className="bg-gray-100 h-px" />

                    {/* 历史记录列表 */}
                    <div className="flex-1 overflow-y-auto py-4">
                        <div className="px-4 mb-2">
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索历史记录"
                                className="h-9 rounded-lg border-gray-200"
                            />
                        </div>
                        <div className="mb-2">
                            {loading ? (
                                <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
                            ) : filteredChats.length === 0 ? (
                                <div className="text-center py-8 text-sm text-gray-400">
                                    {searchQuery ? "未找到相关记录" : "还没有历史对话"}
                                </div>
                            ) : (
                                <>
                                    {/* 今天的对话 */}
                                    {todayChats.length > 0 && (
                                        <>
                                            <button
                                                onClick={() => setTodayOpen((v) => !v)}
                                                className="w-full px-4 flex items-center justify-between text-left"
                                            >
                                                <p className="text-[11px] uppercase tracking-[0.05em] text-gray-400">今天</p>
                                                <ChevronDown
                                                    className={`w-4 h-4 ${SIDEBAR_COLORS.icon.default} transition-transform ${todayOpen ? "rotate-0" : "-rotate-90"
                                                        }`}
                                                />
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {todayOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 4 }}
                                                        transition={{ duration: 0.12 }}
                                                        className="mt-2 space-y-0.5"
                                                    >
                                                        {todayChats.map((chat, i) => (
                                                            <button
                                                                key={`today-${chat.id}-${i}`}
                                                                className={`w-full h-[34px] px-4 text-left ${SIDEBAR_COLORS.bg.hover} cursor-pointer flex items-center rounded-md`}
                                                                onClick={() => {
                                                                    // 加载该条历史对话到右侧主区域
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
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </>
                                    )}

                                    {/* 昨天的对话 */}
                                    {yesterdayChats.length > 0 && (
                                        <div className="mt-3">
                                            <button
                                                onClick={() => setYesterdayOpen((v) => !v)}
                                                className="w-full px-4 flex items-center justify-between text-left"
                                            >
                                                <p className="text-[11px] uppercase tracking-[0.05em] text-gray-400">昨天</p>
                                                <ChevronDown
                                                    className={`w-4 h-4 ${SIDEBAR_COLORS.icon.default} transition-transform ${yesterdayOpen ? "rotate-0" : "-rotate-90"
                                                        }`}
                                                />
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {yesterdayOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 4 }}
                                                        transition={{ duration: 0.12 }}
                                                        className="mt-2 space-y-0.5"
                                                    >
                                                        {yesterdayChats.map((chat, i) => (
                                                            <button
                                                                key={`y-${chat.id}-${i}`}
                                                                className={`w-full h-[34px] px-4 text-left ${SIDEBAR_COLORS.bg.hover} cursor-pointer flex items-center rounded-md`}
                                                                onClick={() => {
                                                                    // 加载该条历史对话到右侧主区域
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
                                                                    昨天
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* 底部账号管理 */}
                    <div className="border-t border-gray-100 px-4 py-4">
                        <AccountManager />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
