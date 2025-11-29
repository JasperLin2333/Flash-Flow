"use client";

import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, VisuallyHidden } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    List,
    Zap,
    MessageSquare,
    BarChart3,
    Mail,
    FileText,
    X,
    ArrowUpRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { flowAPI } from "@/services/flowAPI";
import type { FlowRecord } from "@/types/flow";
import {
    DockIcon,
    AccountManager,
    formatTime,
    renderFlowIcon,
    SIDEBAR_COLORS,
    SIDEBAR_SIZES,
} from "./sidebar-shared";

/**
 * HomeSidebar - 首页侧边栏组件
 * 
 * 功能：
 * 1. 顶级：5个 Icons（仅显示效果）
 * 2. Flowbox 聚合页入口：跳转到完整的 Flowbox 页面
 * 3. Flowbox 快捷列表：显示最近创建的 Flow（卡片头像 + 卡片名称）
 * 4. 底部账号管理
 */
export default function HomeSidebar() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [flows, setFlows] = useState<
        {
            id: string;
            title: string;
            icon_kind?: string;
            icon_name?: string;
            icon_url?: string;
            created_at: string;
        }[]
    >([]);
    const [loading, setLoading] = useState(true);

    // 加载 Flow 列表
    useEffect(() => {
        flowAPI.listFlows().then((data: FlowRecord[]) => {
            const mapped = data
                .map((f: FlowRecord) => ({
                    id: f.id,
                    title: f.name || "未命名工作流",
                    icon_kind: f.icon_kind,
                    icon_name: f.icon_name || undefined,
                    icon_url: f.icon_url || undefined,
                    created_at: f.created_at,
                }))
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setFlows(mapped);
            setLoading(false);
        });
    }, []);

    const filteredFlows = flows.filter((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    className="absolute top-8 left-8 rounded-full bg-black text-white hover:bg-black/90 active:bg-black/95 shadow-md font-semibold transition-all duration-150 h-10 w-10 flex items-center justify-center"
                    aria-label="列表"
                    title="列表"
                >
                    <List className="w-4 h-4" />
                </Button>
            </SheetTrigger>

            <SheetContent side="left" className="bg-white border-r border-gray-200 p-0 shadow-lg">
                <VisuallyHidden>
                    <SheetTitle>侧边栏导航</SheetTitle>
                </VisuallyHidden>
                <div className="h-full flex flex-col">
                    {/* 顶部 Logo 和关闭按钮 */}
                    <div className="py-5 px-4 flex items-center justify-between border-b border-gray-100">
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

                    {/* 5个顶级图标 + 导航按钮 */}
                    <div className="pt-3 pb-2 px-4">
                        {/* 5个顶级 Icons（仅展示） */}
                        <div className="grid grid-cols-5 gap-2">
                            <DockIcon title="聊天">
                                <MessageSquare className={`${SIDEBAR_SIZES.icon} ${SIDEBAR_COLORS.icon.active}`} />
                            </DockIcon>
                            <DockIcon title="自动化">
                                <Zap className={`${SIDEBAR_SIZES.icon} ${SIDEBAR_COLORS.icon.active}`} />
                            </DockIcon>
                            <DockIcon title="分析">
                                <BarChart3 className={`${SIDEBAR_SIZES.icon} ${SIDEBAR_COLORS.icon.active}`} />
                            </DockIcon>
                            <DockIcon title="邮件">
                                <Mail className={`${SIDEBAR_SIZES.icon} ${SIDEBAR_COLORS.icon.active}`} />
                            </DockIcon>
                            <DockIcon title="文档">
                                <FileText className={`${SIDEBAR_SIZES.icon} ${SIDEBAR_COLORS.icon.active}`} />
                            </DockIcon>
                        </div>

                        {/* 导航按钮 */}
                        <div className="mt-3">
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

                    {/* Flowbox 快捷列表 */}
                    <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 scrollbar-track-transparent">
                        <div className="px-4 mb-2">
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索 Flow"
                                className="h-9 rounded-lg border-gray-200"
                            />
                        </div>
                        <div className="px-4 space-y-0.5">
                            {loading ? (
                                <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
                            ) : filteredFlows.length === 0 ? (
                                <div className="text-center py-8 text-sm text-gray-400">
                                    {searchQuery ? "未找到相关 Flow" : "还没有创建任何 Flow"}
                                </div>
                            ) : (
                                filteredFlows.map((f, i) => (
                                    <button
                                        key={`flow-${f.id}-${i}`}
                                        className={`w-full h-[34px] px-4 text-left ${SIDEBAR_COLORS.bg.hover} cursor-pointer flex items-center rounded-md`}
                                        onClick={() => router.push(`/app?flowId=${f.id}`)}
                                    >
                                        <div className="mr-2">{renderFlowIcon(f)}</div>
                                        <span className={`flex-1 min-w-0 ${SIDEBAR_SIZES.text.sm} ${SIDEBAR_COLORS.text.primary} truncate`}>
                                            {f.title}
                                        </span>
                                        <span
                                            className={`flex-shrink-0 ml-3 ${SIDEBAR_SIZES.text.xs} ${SIDEBAR_COLORS.text.label} whitespace-nowrap`}
                                        >
                                            {formatTime(f.created_at)}
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
            </SheetContent>
        </Sheet>
    );
}
