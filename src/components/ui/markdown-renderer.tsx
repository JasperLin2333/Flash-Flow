"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * MarkdownRenderer - Markdown 渲染组件
 * 
 * 支持的语法：
 * - 标题 (h1-h6)
 * - 粗体、斜体、删除线
 * - 有序/无序列表
 * - 代码块和行内代码
 * - 链接和图片
 * - 表格 (GFM)
 * - 任务列表 (GFM)
 * - 引用块
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
    content,
    className = ""
}: MarkdownRendererProps) {
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
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

                    // 代码
                    code: ({ className, children, ...props }) => {
                        const isInline = !className;
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
                    pre: ({ children }) => (
                        <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-[13px] font-mono">
                            {children}
                        </pre>
                    ),

                    // 引用
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-300 pl-3 py-1 my-2 bg-blue-50/50 rounded-r text-gray-700 italic">
                            {children}
                        </blockquote>
                    ),

                    // 链接
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
                        >
                            {children}
                        </a>
                    ),

                    // 图片
                    img: ({ src, alt }) => (
                        <img
                            src={src}
                            alt={alt || ""}
                            className="max-w-full h-auto rounded-lg my-2 border border-gray-200"
                            loading="lazy"
                        />
                    ),

                    // 表格
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-2">
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
