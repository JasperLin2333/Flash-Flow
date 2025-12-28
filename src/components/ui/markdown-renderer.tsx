"use client";

import { Streamdown } from "streamdown";
import { memo } from "react";
import { ImageLightbox } from "./image-lightbox";

interface MarkdownRendererProps {
    content: string;
    className?: string;
    isStreaming?: boolean;
}

/**
 * MarkdownRenderer - Markdown 渲染组件
 * 使用 Streamdown 进行 AI 流式输出优化
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
    content,
    className = "",
    isStreaming = false
}: MarkdownRendererProps) {
    return (
        <div className={`markdown-content ${className} ${isStreaming ? "is-streaming" : ""} relative overflow-x-auto break-words`}>
            <Streamdown
                isAnimating={isStreaming}
                components={{
                    // 图片 - 使用自定义 ImageLightbox 组件
                    img: ({ src, alt }) => (
                        <ImageLightbox src={typeof src === 'string' ? src : undefined} alt={alt} />
                    ),
                }}
            >
                {content}
            </Streamdown>
        </div>
    );
});
