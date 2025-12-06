"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { userProfileAPI } from "@/services/userProfileAPI";
import React from "react";

// ============ 常量 ============
const EMOJI_LIST = [
    "👤", "😀", "😎", "🤖", "👻", "🦊", "🐱", "🐶",
    "🌟", "⚡", "🔥", "💎", "🎯", "🚀", "🌈", "🎨",
];

const DIALOG_STYLE = {
    content: "sm:max-w-[560px] rounded-2xl border border-gray-200 shadow-xl",
};

const BUTTON_STYLE = {
    primary: "bg-black text-white hover:bg-black/90 active:bg-black/95 font-semibold transition-colors duration-150",
    secondary: "border-gray-200 text-gray-900 hover:bg-gray-50",
    tab: {
        active: "bg-black text-white",
        inactive: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    },
};

// Supported image formats
const SUPPORTED_IMAGE_FORMATS = "PNG, JPG, WEBP, GIF";

// ============ 组件 ============
export interface UserAvatarDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    onAvatarChange: (kind: "emoji" | "image", value: string) => void;
}

export function UserAvatarDialog({
    open,
    onOpenChange,
    userId,
    onAvatarChange,
}: UserAvatarDialogProps) {
    const [tab, setTab] = React.useState<"image" | "emoji">("emoji");
    const [uploading, setUploading] = React.useState(false);
    const [selectedEmoji, setSelectedEmoji] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const isValidImageFile = (file: File) => {
        const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
        return validTypes.includes(file.type);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 验证文件类型
        if (!isValidImageFile(file)) {
            alert(`不支持的文件格式。支持: ${SUPPORTED_IMAGE_FORMATS}`);
            return;
        }

        setUploading(true);
        try {
            const url = await userProfileAPI.uploadAvatar(file, userId);
            if (url) {
                await userProfileAPI.updateAvatarImage(userId, url);
                onAvatarChange("image", url);
                onOpenChange(false);
            } else {
                alert("上传失败，请检查存储桶配置 user-avatars");
            }
        } finally {
            setUploading(false);
            // 重置文件输入
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleEmojiClick = (emoji: string) => {
        setSelectedEmoji(emoji);
    };

    const handleConfirm = async () => {
        if (tab === "emoji" && selectedEmoji) {
            try {
                await userProfileAPI.updateAvatarEmoji(userId, selectedEmoji);
                onAvatarChange("emoji", selectedEmoji);
                onOpenChange(false);
            } catch (error) {
                console.error("Failed to update emoji:", error);
                alert("更新头像失败");
            }
        } else {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={DIALOG_STYLE.content}>
                <DialogHeader>
                    <DialogTitle className="font-bold text-base">更换头像</DialogTitle>
                </DialogHeader>

                {/* Tab 切换按钮 */}
                <div className="flex items-center gap-2 mb-3">
                    <button
                        className={cn(
                            "px-3 h-8 rounded-md text-sm font-semibold transition-colors duration-150",
                            tab === "emoji" ? BUTTON_STYLE.tab.active : BUTTON_STYLE.tab.inactive
                        )}
                        onClick={() => setTab("emoji")}
                    >
                        表情符号
                    </button>
                    <button
                        className={cn(
                            "px-3 h-8 rounded-md text-sm font-semibold transition-colors duration-150",
                            tab === "image" ? BUTTON_STYLE.tab.active : BUTTON_STYLE.tab.inactive
                        )}
                        onClick={() => setTab("image")}
                    >
                        上传图片
                    </button>
                </div>

                {tab === "emoji" ? (
                    /* 表情符号网格 */
                    <div className="grid grid-cols-8 gap-2">
                        {EMOJI_LIST.map((emoji) => (
                            <button
                                key={emoji}
                                className={cn(
                                    "h-10 rounded-lg border transition-colors duration-150 font-medium text-lg",
                                    selectedEmoji === emoji
                                        ? "border-black bg-gray-100 ring-2 ring-black/10"
                                        : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                )}
                                onClick={() => handleEmojiClick(emoji)}
                                disabled={uploading}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                ) : (
                    /* 图片上传区域 */
                    <div>
                        <div
                            className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:bg-gray-50 hover:border-gray-300 transition-colors duration-150 cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div className="text-sm text-gray-600">点击选择文件或拖拽文件到此处</div>
                            <div className="text-xs text-gray-500 mt-2">支持 {SUPPORTED_IMAGE_FORMATS} 格式</div>
                            {uploading && (
                                <div className="text-xs mt-2 text-gray-600 font-medium">上传中...</div>
                            )}
                        </div>
                    </div>
                )}

                {/* 底部按钮 */}
                <div className="flex justify-end gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className={BUTTON_STYLE.secondary}
                        disabled={uploading}
                    >
                        取消
                    </Button>
                    <Button
                        className={BUTTON_STYLE.primary}
                        onClick={handleConfirm}
                        disabled={uploading || (tab === "emoji" && !selectedEmoji)}
                    >
                        确认
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
