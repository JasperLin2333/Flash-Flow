import { useState, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { User, Copy, Check, Eye, Download, X, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { STYLES, getFileIcon, type FlowIconConfig, type Message, type Attachment } from "./constants";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface MessageBubbleProps {
    role: Message["role"];
    content: string;
    reasoning?: string; // 思考过程
    files?: File[];
    attachments?: Attachment[];
    flowIcon?: FlowIconConfig;
    timestamp?: Date;
    isStreaming?: boolean; // 新增：标识是否正在流式输出
    isStreamingReasoning?: boolean; // 是否正在流式输出思考过程
}

/**
 * 格式化时间为可读字符串
 */
function formatTimestamp(date: Date): string {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
    });

    if (isToday) {
        return `今天 ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${timeStr}`;
    }

    return date.toLocaleDateString("zh-CN", {
        month: "numeric",
        day: "numeric",
    }) + " " + timeStr;
}

/**
 * MessageBubble - 消息气泡组件
 * 支持用户和助手两种角色
 * AI回复支持鼠标悬停显示时间戳和复制按钮
 */
export const MessageBubble = memo(function MessageBubble({ role, content, reasoning, files, attachments, flowIcon, timestamp, isStreaming, isStreamingReasoning }: MessageBubbleProps) {
    const isUser = role === "user";
    const [isHovered, setIsHovered] = useState(false);
    const [copied, setCopied] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

    // 处理图片下载
    const handleDownload = useCallback(async (url: string, fileName: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            // Fallback: open in new tab
            window.open(url, "_blank");
        }
    }, []);

    const bubbleStyle = isUser
        ? "bg-blue-100 text-gray-900 border border-blue-200"
        : "bg-white text-gray-900 border border-gray-200";

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy message:", err);
        }
    }, [content]);

    return (
        <div
            className={`flex gap-3 items-start ${isUser ? "flex-row-reverse" : ""}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`${STYLES.avatar} ${isUser ? "bg-gray-200" : ""}`}>
                {isUser ? (
                    <User className="w-5 h-5 text-gray-600" />
                ) : (
                    <AppIcon flowIcon={flowIcon} className="w-8 h-8" />
                )}
            </div>
            <div className={`flex flex-col gap-2 ${isUser ? "max-w-[80%]" : "max-w-[80%]"}`}>
                {/* AI回复时间戳和复制按钮 - 鼠标悬停时显示 */}
                {!isUser && (
                    <div
                        className={`flex items-center gap-3 transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}
                    >
                        {timestamp && (
                            <span className="text-xs text-gray-400">
                                {formatTimestamp(timestamp)}
                            </span>
                        )}
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="复制消息"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3 h-3 text-green-500" />
                                    <span className="text-green-500">已复制</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3 h-3" />
                                    <span>复制</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
                {/* 思考过程区块 - 仅在有 reasoning 内容时显示 */}
                {!isUser && (reasoning || isStreamingReasoning) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                        <button
                            onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                            className="flex items-center gap-2 w-full text-left hover:text-gray-800 transition-colors"
                        >
                            <Brain className="w-4 h-4 text-purple-500" />
                            <span className="font-medium">
                                {isStreamingReasoning ? "思考中..." : "思考过程"}
                            </span>
                            {isStreamingReasoning && (
                                <span className="ml-1 inline-block w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                            )}
                            <span className="ml-auto">
                                {isReasoningExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                        </button>
                        {isReasoningExpanded && reasoning && (
                            <div className="mt-2 pt-2 border-t border-gray-200 whitespace-pre-wrap text-gray-500">
                                {reasoning}
                            </div>
                        )}
                    </div>
                )}
                <div className={`${STYLES.messageBubble} ${bubbleStyle} w-fit overflow-hidden ${isUser ? "ml-auto" : ""}`}>
                    {isUser ? (
                        // 用户消息：保持纯文本
                        <div className="whitespace-pre-wrap">{content}</div>
                    ) : (
                        // 助手消息：渲染 Markdown
                        <MarkdownRenderer content={content} isStreaming={isStreaming} />
                    )}
                </div>
                {files && files.length > 0 && (
                    <div className={`flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pb-1 max-w-full ${isUser ? "justify-end" : "justify-start"}`}>
                        {files.map((file, i) => {
                            // 判断是否为图片类型
                            const isImage = file.type?.startsWith('image/') ||
                                /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(file.name);

                            // 图片类型：显示为小缩略图
                            if (isImage) {
                                const objectUrl = URL.createObjectURL(file);
                                return (
                                    <div
                                        key={i}
                                        className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm shrink-0"
                                    >
                                        <img
                                            src={objectUrl}
                                            alt={file.name}
                                            className="w-14 h-14 object-cover bg-gray-50"
                                            loading="lazy"
                                            onLoad={() => URL.revokeObjectURL(objectUrl)}
                                        />
                                    </div>
                                );
                            }

                            // 非图片类型：保持原有的文件卡片
                            const Icon = getFileIcon(file.name);
                            return (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 min-w-[160px] max-w-[200px] shrink-0">
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-700 truncate" title={file.name}>{file.name}</p>
                                        <p className="text-[10px] text-gray-400 truncate">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {attachments && attachments.length > 0 && (
                    <div className={`flex flex-wrap gap-2 max-w-full ${isUser ? "justify-end" : "justify-start"}`}>
                        {attachments.map((file, i) => {
                            // 判断是否为图片类型
                            const isImage = file.type?.startsWith('image/') ||
                                /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(file.name);

                            // 图片类型：显示为预览图 + 工具栏
                            if (isImage) {
                                return (
                                    <div
                                        key={i}
                                        className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-200 group"
                                    >
                                        <img
                                            src={file.url}
                                            alt={file.name}
                                            className="max-w-xs max-h-64 object-contain bg-gray-50 cursor-pointer"
                                            loading="lazy"
                                            onClick={() => setPreviewImage(file.url)}
                                        />
                                        {/* 悬停工具栏 */}
                                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-gray-900/90 backdrop-blur-sm rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setPreviewImage(file.url)}
                                                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                                                title="预览"
                                            >
                                                <Eye className="w-4 h-4 text-white" />
                                            </button>
                                            <div className="w-px h-4 bg-white/30" />
                                            <button
                                                onClick={() => handleDownload(file.url, file.name)}
                                                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                                                title="下载"
                                            >
                                                <Download className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            // 非图片类型：保持原有的文件下载卡片
                            const Icon = getFileIcon(file.name);
                            return (
                                <a
                                    key={i}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 min-w-[160px] max-w-[200px] shrink-0 no-underline cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-700 truncate" title={file.name}>{file.name}</p>
                                        {file.size ? (
                                            <p className="text-[10px] text-gray-400 truncate">{(file.size / 1024).toFixed(1)} KB</p>
                                        ) : (
                                            <p className="text-[10px] text-gray-400 truncate">点击下载</p>
                                        )}
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 图片预览模态 - Portal 渲染 */}
            {previewImage && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        />
                        {/* 关闭按钮 */}
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                        {/* 底部工具栏 */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm rounded-full px-4 py-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(previewImage, `image_${Date.now()}.png`);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors text-white text-sm"
                            >
                                <Download className="w-4 h-4" />
                                下载原图
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});
