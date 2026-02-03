"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { uploadFlowIcon, isValidImageFile, SUPPORTED_IMAGE_FORMATS } from "./flowCardUtils";
import React from "react";
import { toast } from "@/hooks/use-toast";

// 文件大小限制常量
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ============ 常量 ============
const EMOJI_LIST = [
  "📄", "⚡", "🌐", "📘", "🔗", "🤖", "🧠", "🧩",
  "📊", "📦", "📝", "🔍", "🗂️", "🧾", "🧱", "🔧",
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

// ============ 组件 ============
export interface AvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  ownerId: string;
  onImageSelect: (url: string) => Promise<void>;
  onEmojiSelect: (emoji: string) => Promise<void>;
}

export function AvatarDialog({
  open,
  onOpenChange,
  flowId,
  ownerId,
  onImageSelect,
  onEmojiSelect,
}: AvatarDialogProps) {
  const [tab, setTab] = React.useState<"image" | "emoji">("image");
  const [uploading, setUploading] = React.useState(false);
  const [selectedEmoji, setSelectedEmoji] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setTab("image");
      setSelectedEmoji(null);
    }
  }, [open]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    // 验证文件类型
    if (!isValidImageFile(file)) {
      toast({
        title: "不支持的文件格式",
        description: `请上传 ${SUPPORTED_IMAGE_FORMATS} 格式的图片`,
        variant: "destructive",
      });
      return;
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "文件过大",
        description: `图片大小不能超过 ${MAX_FILE_SIZE_MB}MB，当前文件大小为 ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadFlowIcon(file, flowId, ownerId);
      if (url) {
        await onImageSelect(url);
        onOpenChange(false);
      } else {
        toast({
          title: "上传失败",
          description: "无法上传图片，请检查网络后重试",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "上传失败",
        description: "上传过程中发生错误，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setSelectedEmoji(emoji);
  };

  const handleConfirm = async () => {
    if (tab === "emoji" && selectedEmoji) {
      try {
        await onEmojiSelect(selectedEmoji);
        onOpenChange(false);
      } catch (error) {
        // 错误已在 FlowCard 的 handleEmojiSelect 中处理
        console.error("Failed to update emoji:", error);
      }
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_STYLE.content} onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-bold text-base">更换头像</DialogTitle>
        </DialogHeader>

        {/* Tab 切换按钮 */}
        <div className="flex items-center gap-2 mb-3">
          <button
            className={cn(
              "px-3 h-8 rounded-md text-sm font-semibold transition-colors duration-150",
              tab === "image" ? BUTTON_STYLE.tab.active : BUTTON_STYLE.tab.inactive
            )}
            onClick={() => setTab("image")}
          >
            图片
          </button>
          <button
            className={cn(
              "px-3 h-8 rounded-md text-sm font-semibold transition-colors duration-150",
              tab === "emoji" ? BUTTON_STYLE.tab.active : BUTTON_STYLE.tab.inactive
            )}
            onClick={() => setTab("emoji")}
          >
            表情符号
          </button>
        </div>

        {/* 图片上传区域 */}
        {tab === "image" ? (
          <div>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-150 cursor-pointer",
                isDragging
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className={cn("text-sm", isDragging ? "text-black" : "text-gray-600")}>
                {isDragging ? "松开鼠标上传文件" : "点击选择文件或拖拽文件到此处"}
              </div>
              <div className="text-xs text-gray-500 mt-2">支持 {SUPPORTED_IMAGE_FORMATS} 格式，最大 {MAX_FILE_SIZE_MB}MB</div>
              {uploading && (
                <div className="text-xs mt-2 text-gray-600 font-medium">上传中…</div>
              )}
            </div>
          </div>
        ) : (
          /* 表情符号网格 */
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                className={cn(
                  "h-10 rounded-lg border transition-colors duration-150 font-medium",
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
