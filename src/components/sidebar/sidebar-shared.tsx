"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Settings, Pencil } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";
import { UserAvatarDialog } from "@/components/auth/UserAvatarDialog";
import { userProfileAPI } from "@/services/userProfileAPI";

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
 * 支持：修改用户名称、修改头像（emoji + 图片上传）
 */
export function AccountManager() {
    const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);
    const [avatarDialogOpen, setAvatarDialogOpen] = React.useState(false);
    const [isEditingName, setIsEditingName] = React.useState(false);
    const [editName, setEditName] = React.useState("");
    const [profile, setProfile] = React.useState<{
        display_name: string | null;
        avatar_kind: "emoji" | "image";
        avatar_emoji: string | null;
        avatar_url: string | null;
    } | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const isLoading = useAuthStore((s) => s.isLoading);

    // Load profile on mount and clear on logout
    React.useEffect(() => {
        if (user?.id) {
            userProfileAPI.getProfile(user.id)
                .then((p) => {
                    if (p) {
                        setProfile({
                            display_name: p.display_name,
                            avatar_kind: p.avatar_kind,
                            avatar_emoji: p.avatar_emoji,
                            avatar_url: p.avatar_url,
                        });
                    }
                })
                .catch((err) => {
                    // 静默处理错误，使用默认状态
                    console.warn("[AccountManager] Failed to load profile:", err?.message || err);
                });
        } else {
            // Explicitly clear profile state when user logs out
            setProfile(null);
            setEditName("");
            setIsEditingName(false);
        }
    }, [user?.id]);

    // 提取用户显示信息
    const displayName = profile?.display_name || (user as any)?.user_metadata?.name || user?.email?.split("@")[0] || "访客";
    const displayEmail = user?.email || "guest@example.com";

    // Avatar display logic
    const renderAvatar = () => {
        if (profile?.avatar_kind === "image" && profile.avatar_url) {
            return (
                <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="w-full h-full rounded-full object-cover"
                />
            );
        }
        if (profile?.avatar_kind === "emoji" && profile.avatar_emoji) {
            return <span className="text-lg">{profile.avatar_emoji}</span>;
        }
        return <User className="w-5 h-5 text-gray-600" />;
    };

    const handleLogout = async () => {
        await logout();
    };

    const handleSaveName = async () => {
        if (!user?.id || !editName.trim()) return;
        setIsSaving(true);
        try {
            const updated = await userProfileAPI.updateDisplayName(user.id, editName.trim());
            if (updated) {
                setProfile((prev) => prev ? { ...prev, display_name: updated.display_name } : null);
            }
        } finally {
            setIsSaving(false);
            setIsEditingName(false);
        }
    };

    const handleAvatarChange = (kind: "emoji" | "image", value: string) => {
        setProfile((prev) => prev ? {
            ...prev,
            avatar_kind: kind,
            avatar_emoji: kind === "emoji" ? value : null,
            avatar_url: kind === "image" ? value : null,
        } : {
            display_name: null,
            avatar_kind: kind,
            avatar_emoji: kind === "emoji" ? value : null,
            avatar_url: kind === "image" ? value : null,
        });
    };

    return (
        <>
            <Dialog>
                <DialogTrigger asChild>
                    <button className="w-full flex items-center group rounded-lg hover:bg-gray-50 px-2 py-1.5 transition-all duration-150">
                        <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center transition-all duration-200 group-hover:ring-2 group-hover:ring-black/10 group-hover:scale-105 group-hover:shadow-sm overflow-hidden">
                            {renderAvatar()}
                        </div>
                        <span className="ml-2.5 text-[13px] font-semibold text-gray-900 group-hover:text-black transition-colors duration-150 truncate flex-1">
                            {displayName}
                        </span>
                        <div className="ml-auto flex items-center gap-3">
                            <Settings className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors duration-150" />
                        </div>
                    </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm rounded-2xl border border-gray-200 shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-base">个人中心</DialogTitle>
                        <DialogDescription className="text-xs text-gray-500">设置你的专属档案</DialogDescription>
                    </DialogHeader>

                    {/* Profile Section - Editable */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {/* Clickable Avatar */}
                        <button
                            onClick={() => user?.id && setAvatarDialogOpen(true)}
                            className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border border-gray-300 overflow-hidden hover:ring-2 hover:ring-black/20 transition-all cursor-pointer relative group"
                            title="点击更换头像"
                        >
                            {renderAvatar()}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Pencil className="w-4 h-4 text-white" />
                            </div>
                        </button>

                        <div className="flex-1 min-w-0">
                            {/* Editable Display Name */}
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black/20"
                                        placeholder="输入用户名"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveName();
                                            if (e.key === "Escape") setIsEditingName(false);
                                        }}
                                    />
                                    <button
                                        onClick={handleSaveName}
                                        disabled={isSaving}
                                        className="text-xs px-2 py-1 bg-black text-white rounded hover:bg-black/90 disabled:opacity-50"
                                    >
                                        {isSaving ? "..." : "保存"}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setEditName(displayName);
                                        setIsEditingName(true);
                                    }}
                                    className="text-sm font-semibold text-gray-900 truncate hover:text-black flex items-center gap-1 group"
                                >
                                    {displayName}
                                    <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            )}
                            <div className="text-xs text-gray-500 truncate">{displayEmail}</div>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        {user ? (
                            <>
                                <button
                                    className="w-full h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-900 transition-colors duration-150"
                                    onClick={() => setChangePasswordOpen(true)}
                                    disabled={isLoading}
                                >
                                    账号安全设置
                                </button>
                                <button
                                    className="w-full h-9 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium transition-all duration-150"
                                    onClick={handleLogout}
                                    disabled={isLoading}
                                >
                                    {isLoading ? "退出中..." : "退出当前账号"}
                                </button>
                            </>
                        ) : (
                            <div className="text-center text-xs text-gray-400 py-2">
                                请登录以管理账号
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <ChangePasswordDialog
                open={changePasswordOpen}
                onOpenChange={setChangePasswordOpen}
            />

            {/* User Avatar Dialog */}
            {user?.id && (
                <UserAvatarDialog
                    open={avatarDialogOpen}
                    onOpenChange={setAvatarDialogOpen}
                    userId={user.id}
                    onAvatarChange={handleAvatarChange}
                />
            )}
        </>
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
 * @param flow - Flow 数据
 * @param large - 是否使用大尺寸图标（用于卡片展示）
 */
export function renderFlowIcon(flow: {
    icon_kind?: string;
    icon_name?: string;
    icon_url?: string;
    title: string;
}, large?: boolean) {
    const size = large ? "w-10 h-10" : "w-6 h-6";
    const fontSize = large ? "text-[18px]" : "text-[11px]";
    const containerSize = large ? "w-10 h-10" : "w-6 h-6";

    if (flow.icon_kind === "image" && flow.icon_url) {
        return <img src={flow.icon_url} alt="icon" className={`${size} rounded-full object-cover`} />;
    }

    // 优先使用 icon_name (emoji)，如果没有则使用默认 emoji
    const display = flow.icon_name || "📄";
    return (
        <div className={`${containerSize} flex items-center justify-center ${fontSize} text-gray-700`}>
            {display}
        </div>
    );
}
