"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { memo } from "react";
import { CodeBlock } from "./code-block";
import { ImageLightbox } from "./image-lightbox";

interface MarkdownRendererProps {
    content: string;
    className?: string;
    isStreaming?: boolean; // 新增：标识是否正在流式输出
}

/**
 * MarkdownRenderer - Markdown 渲染组件
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
    content,
    className = "",
    isStreaming = false
}: MarkdownRendererProps) {
    return (
        <div className={`markdown-content ${className} ${isStreaming ? "is-streaming" : ""} relative`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // ... existing components ...
                    // 标题
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-bold mt-3 mb-2 first:mt-0">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>
                    ),

                    // 段落
                    p: ({ children }) => (
                        <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                    ),

                    // 强调
                    strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic">{children}</em>
                    ),
                    del: ({ children }) => (
                        <del className="line-through opacity-70">{children}</del>
                    ),

                    // 列表
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-2 space-y-1 pl-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-2 space-y-1 pl-1">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                    ),

                    // 代码块 - 使用 CodeBlock 组件
                    pre: ({ children }) => {
                        // 从 children 中提取 code 元素的 className 来获取语言
                        const codeChild = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
                        const codeClassName = codeChild?.props?.className || "";
                        const language = codeClassName.replace(/language-/, "").replace(/hljs/, "").trim();

                        return (
                            <CodeBlock language={language} className={codeClassName}>
                                {children}
                            </CodeBlock>
                        );
                    },

                    // 行内代码
                    code: ({ className, children, ...props }) => {
                        const isInline = !className || !className.includes("hljs");
                        if (isInline) {
                            return (
                                <code
                                    className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-[13px] font-mono"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className={`${className} text-[13px]`} {...props}>
                                {children}
                            </code>
                        );
                    },

                    // 引用
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-gray-300 pl-3 py-1 my-2 bg-gray-50 rounded-r text-gray-700 italic">
                            {children}
                        </blockquote>
                    ),

                    // 链接
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-900 hover:text-black underline underline-offset-2"
                        >
                            {children}
                        </a>
                    ),

                    // 图片 - 使用 ImageLightbox 组件
                    img: ({ src, alt }) => (
                        <ImageLightbox src={typeof src === 'string' ? src : undefined} alt={alt} />
                    ),

                    // 表格 - 添加 scroll-snap 优化移动端体验
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-2 scroll-snap-x scroll-snap-mandatory">
                            <table className="min-w-full border-collapse text-sm">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-gray-50">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-gray-200">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="border-b border-gray-200">{children}</tr>
                    ),
                    th: ({ children }) => (
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-3 py-2 text-gray-600 border border-gray-200">
                            {children}
                        </td>
                    ),

                    // 分隔线
                    hr: () => (
                        <hr className="my-4 border-gray-200" />
                    ),

                    // 任务列表
                    input: ({ checked, ...props }) => (
                        <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="mr-2 rounded"
                            {...props}
                        />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
});
