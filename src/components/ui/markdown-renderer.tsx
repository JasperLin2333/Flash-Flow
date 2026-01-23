"use client";

import { Streamdown } from "streamdown";
import { memo, useMemo } from "react";
import { ImageLightbox } from "./image-lightbox";

interface MarkdownRendererProps {
    content: string;
    className?: string;
    isStreaming?: boolean;
}

/**
 * Sanitize content by removing/escaping custom XML tags that could be misinterpreted as HTML
 * This prevents console errors like "The tag <clarification> is unrecognized"
 */
function sanitizeContent(content: string): string {
    // List of custom XML tags used by the AI agent that should be stripped or escaped
    const customTags = ['clarification', 'step', 'thinking', 'suggestion', 'plan'];

    let sanitized = content;

    for (const tag of customTags) {
        // Replace opening and closing tags with escaped versions (visible but not parsed as HTML)
        // Use a code-like format so users can see the structure if needed
        sanitized = sanitized
            .replace(new RegExp(`<${tag}[^>]*>`, 'gi'), `【${tag}】`)
            .replace(new RegExp(`</${tag}>`, 'gi'), `【/${tag}】`);
    }

    return sanitized;
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
    // Memoize sanitized content to avoid re-processing on every render
    const sanitizedContent = useMemo(() => sanitizeContent(content), [content]);

    return (
        <div className={`markdown-content ${className} ${isStreaming ? "is-streaming" : ""} relative overflow-x-auto break-words`}>
            <Streamdown
                isAnimating={isStreaming}
                components={{
                    // 图片 - 使用自定义 ImageLightbox 组件
                    img: ({ src, alt }) => (
                        <ImageLightbox src={typeof src === 'string' ? src : undefined} alt={alt} />
                    ),
                    // 段落 - 使用 div 替代 p，避免嵌套 div/pre 导致的 hydration mismatch
                    p: ({ children }) => <div className="mb-2 last:mb-0 leading-relaxed">{children}</div>,
                }}
            >
                {sanitizedContent}
            </Streamdown>
        </div>
    );
});
