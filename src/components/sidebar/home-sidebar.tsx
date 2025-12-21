"use client";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ChevronDown,
    ArrowUpRight,
    List,
} from "lucide-react";
import Image from "next/image";
import LogoBlack from "@/app/logoBlack.png";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { flowAPI } from "@/services/flowAPI";
import type { FlowRecord } from "@/types/flow";
import {
    AccountManager,
    renderFlowIcon,
} from "./sidebar-shared";
import { toast } from "@/hooks/use-toast";

// Sidebar width constant
const SIDEBAR_WIDTH = 280;

interface HomeSidebarProps {
    isOpen: boolean;
    onToggle: (open: boolean) => void;
}

/**
 * HomeSidebar - 首页侧边栏组件 (Persistent Panel)
 * 
 * 功能：
 * 1. 顶级：5个 Icons（仅显示效果）
 * 2. Flowbox 聚合页入口：跳转到完整的 Flowbox 页面
 * 3. Flowbox 快捷列表：显示最近创建的 Flow（卡片头像 + 卡片名称）
 * 4. 底部账号管理
 * 
 * 改进：持久化展开，无遮罩，作为页面布局的一部分
 */
export default function HomeSidebar({ isOpen, onToggle }: HomeSidebarProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [flows, setFlows] = useState<
        {
            id: string;
            title: string;
            description?: string;
            icon_kind?: string;
            icon_name?: string;
            icon_url?: string;
            created_at: string;
        }[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // 加载 Flow 列表
    useEffect(() => {
        setLoadError(null);
        flowAPI.listFlows()
            .then((data: FlowRecord[]) => {
                const mapped = data
                    .map((f: FlowRecord) => ({
                        id: f.id,
                        title: f.name || "未命名工作流",
                        description: f.description,
                        icon_kind: f.icon_kind,
                        icon_name: f.icon_name || undefined,
                        icon_url: f.icon_url || undefined,
                        created_at: f.created_at,
                    }))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setFlows(mapped);
            })
            .catch((err) => {
                const errorMsg = err?.message || String(err);
                console.warn("[HomeSidebar] Failed to load flows:", errorMsg);
                setFlows([]);

                // 区分错误类型：未登录静默处理，其他错误显示提示
                if (errorMsg.includes("未登录") || errorMsg.includes("not authenticated") || errorMsg.includes("User not logged in")) {
                    // 未登录状态，静默处理
                } else if (errorMsg.includes("network") || errorMsg.includes("fetch") || errorMsg.includes("Failed to fetch")) {
                    setLoadError("网络连接失败");
                    toast({
                        title: "加载失败",
                        description: "网络连接失败，请检查网络后重试",
                        variant: "destructive",
                    });
                } else {
                    setLoadError("加载失败");
                }
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const filteredFlows = useMemo(
        () => flows.filter((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase())),
        [flows, searchQuery]
    );

    return (
        <>
            {/* Toggle Button - Only visible when sidebar is closed */}
            {!isOpen && (
                <Button
                    onClick={() => onToggle(true)}
                    className="fixed top-8 left-8 z-50 rounded-full bg-black text-white hover:bg-gray-800 active:bg-gray-700 shadow-md font-semibold transition-all duration-150 h-10 w-10 flex items-center justify-center border border-gray-800"
                    aria-label="打开侧边栏"
                    title="打开侧边栏"
                >
                    <List className="w-4 h-4" />
                </Button>
            )}

            {/* Sidebar Panel - Persistent, no overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        initial={{ x: -SIDEBAR_WIDTH, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -SIDEBAR_WIDTH, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-lg z-40"
                        style={{ width: SIDEBAR_WIDTH }}
                    >
                        <div className="h-full flex flex-col relative">
                            {/* 关闭按钮：右侧垂直居中箭头 */}
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



                            {/* Flow Box Navigation Item */}
                            <div className="px-3 pt-5 pb-2">
                                <button
                                    onClick={() => router.push("/flows")}
                                    className="w-full group flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-sm hover:shadow-md transition-all duration-200"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            <Image src={LogoBlack} alt="Flow Box" className="w-full h-full object-contain" />
                                        </div>
                                        <span className="text-[15px] font-medium tracking-wide">Flow Box</span>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />

                                </button>
                            </div>
                            <Separator className="bg-gray-100 h-px mt-1" />

                            {/* Flowbox 快捷列表 */}
                            <div className="flex-1 overflow-y-auto py-5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                                <div className="px-4 mb-2">
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="搜索助手"
                                        className="h-9 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 transition-all duration-200"
                                    />
                                </div>
                                <div className="px-4 space-y-1.5">
                                    {loading ? (
                                        <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
                                    ) : loadError ? (
                                        <div className="text-center py-8 text-sm text-red-500">
                                            {loadError}
                                            <button
                                                onClick={() => window.location.reload()}
                                                className="block mx-auto mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                                            >
                                                点击刷新重试
                                            </button>
                                        </div>
                                    ) : filteredFlows.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-gray-400">
                                            {searchQuery ? "未找到相关 Flow" : "还没有创建任何 Flow"}
                                        </div>
                                    ) : (
                                        filteredFlows.map((f, i) => (
                                            <button
                                                key={`flow-${f.id}-${i}`}
                                                className="w-full p-2.5 text-left hover:bg-gray-100/80 cursor-pointer flex items-start gap-3 rounded-xl transition-all duration-200 group"
                                                onClick={() => router.push(`/app?flowId=${f.id}`)}
                                            >
                                                {/* Flow Icon - Larger & Cleaner */}
                                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden group-hover:bg-white group-hover:shadow-sm transition-all duration-200">
                                                    {renderFlowIcon(f, true)}
                                                </div>
                                                {/* Content */}
                                                <div className="flex-1 min-w-0 py-0.5">
                                                    <div className="text-[14px] font-medium text-gray-900 truncate leading-tight group-hover:text-black transition-colors">
                                                        {f.title}
                                                    </div>
                                                    <div className="mt-0.5 text-[12px] text-gray-500 leading-snug truncate group-hover:text-gray-600 transition-colors">
                                                        {f.description || "点击开始使用"}
                                                    </div>
                                                </div>
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

// Export sidebar width for layout calculations
export { SIDEBAR_WIDTH };

