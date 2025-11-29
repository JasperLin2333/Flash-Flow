"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Settings } from "lucide-react";

/**
 * Design System Constants - 统一色彩规范
 * 提取自原 SidebarDrawer，确保所有侧边栏组件使用一致的视觉设计
 */
export const SIDEBAR_COLORS = {
    icon: {
        default: "text-gray-400",
        hover: "text-gray-600",
        active: "text-gray-700",
    },
    text: {
        primary: "text-gray-900",
        secondary: "text-gray-500",
        label: "text-gray-400",
    },
    bg: {
        hover: "hover:bg-gray-50",
    },
} as const;

export const SIDEBAR_SIZES = {
    icon: "w-[18px] h-[18px]",
    text: {
        xs: "text-xs",
        sm: "text-[13px]",
    },
} as const;

/**
 * DockIcon - 顶级图标按钮组件
 * 用于首页侧边栏的5个顶级图标展示
 */
export function DockIcon({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <button
            aria-label={title}
            className="group relative w-9 h-9 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 flex items-center justify-center transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] shadow-xs"
        >
            {children}
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 bg-gray-900 text-white text-[11px] rounded-md px-2 py-1 shadow-md whitespace-nowrap font-medium transition-all duration-150">
                {title}
            </span>
        </button>
    );
}

/**
 * AccountManager - 账号管理弹窗组件
 * 用于首页和App页侧边栏的底部账号管理功能
 */
export function AccountManager() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="w-full flex items-center group rounded-lg hover:bg-gray-50 px-2 py-1.5 transition-all duration-150">
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center transition-all duration-200 group-hover:ring-2 group-hover:ring-black/10 group-hover:scale-105 group-hover:shadow-sm">
                        <User className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="ml-2.5 text-[13px] font-semibold text-gray-900 group-hover:text-black transition-colors duration-150">访客</span>
                    <div className="ml-auto flex items-center gap-3">
                        <Settings className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors duration-150" />
                    </div>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="font-bold text-base">账号</DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">管理个人资料和偏好设置</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border border-gray-300">
                        <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900">访客</div>
                        <div className="text-xs text-gray-500">guest@example.com</div>
                    </div>
                </div>
                <div className="mt-4 space-y-2">
                    <button className="w-full h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-900 transition-colors duration-150">
                        管理账号
                    </button>
                    <button className="w-full h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-900 transition-colors duration-150">
                        切换工作区
                    </button>
                    <button className="w-full h-9 rounded-lg bg-red-600 text-white hover:bg-red-700 active:bg-red-800 text-sm font-semibold transition-all duration-150">
                        退出登录
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * formatTime - 时间格式化工具函数
 * 将 ISO 时间字符串转换为相对时间描述
 * @param iso - ISO 格式的时间字符串
 * @returns 格式化后的时间描述
 */
export function formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "昨天";
    return `${diffDays} 天前`;
}

/**
 * renderFlowIcon - Flow 图标渲染函数
 * 根据 icon_kind 渲染不同类型的图标
 */
export function renderFlowIcon(flow: {
    icon_kind?: string;
    icon_name?: string;
    icon_url?: string;
    title: string;
}) {
    if (flow.icon_kind === "image" && flow.icon_url) {
        return <img src={flow.icon_url} alt="icon" className="w-6 h-6 rounded-full object-cover" />;
    }

    // 优先使用 icon_name (emoji)，如果没有则使用默认 emoji
    const display = flow.icon_name || "📄";
    return (
        <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] text-gray-700">
            {display}
        </div>
    );
}
