import { User } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { STYLES, getFileIcon, type FlowIconConfig, type Message } from "./constants";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface MessageBubbleProps {
    role: Message["role"];
    content: string;
    files?: File[];
    flowIcon?: FlowIconConfig;
}

/**
 * MessageBubble - 消息气泡组件
 * 支持用户和助手两种角色
 */
export function MessageBubble({ role, content, files, flowIcon }: MessageBubbleProps) {
    const isUser = role === "user";
    const bubbleStyle = isUser
        ? "bg-blue-600 text-white border border-blue-600"
        : "bg-white text-gray-900 border border-gray-200";

    return (
        <div className={`flex gap-3 items-start ${isUser ? "flex-row-reverse" : ""}`}>
            <div className={`${STYLES.avatar} ${isUser ? "bg-gray-200" : ""}`}>
                {isUser ? (
                    <User className="w-5 h-5 text-gray-600" />
                ) : (
                    <AppIcon flowIcon={flowIcon} className="w-8 h-8" />
                )}
            </div>
            <div className={`flex flex-col gap-2 ${isUser ? "max-w-[80%]" : "max-w-[80%]"}`}>
                <div className={`${STYLES.messageBubble} ${bubbleStyle} w-fit ${isUser ? "ml-auto" : ""}`}>
                    {isUser ? (
                        // 用户消息：保持纯文本
                        <div className="whitespace-pre-wrap">{content}</div>
                    ) : (
                        // 助手消息：渲染 Markdown
                        <MarkdownRenderer content={content} />
                    )}
                </div>
                {files && files.length > 0 && (
                    <div className={`flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pb-1 max-w-full ${isUser ? "justify-end" : "justify-start"}`}>
                        {files.map((file, i) => {
                            const Icon = getFileIcon(file.name);
                            return (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 min-w-[160px] max-w-[200px] shrink-0">
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-blue-500 shrink-0">
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
            </div>
        </div>
    );
}
