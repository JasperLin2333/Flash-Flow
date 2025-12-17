"use client";

import { useState, memo, useRef, useEffect, useMemo } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

interface CodeBlockProps {
    children: React.ReactNode;
    className?: string;
    language?: string;
}

const MAX_COLLAPSED_LINES = 15;

// 常见语言映射，用于显示更友好的名称
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    tsx: "TypeScript",
    jsx: "JavaScript",
    py: "Python",
    python: "Python",
    rb: "Ruby",
    ruby: "Ruby",
    go: "Go",
    rust: "Rust",
    rs: "Rust",
    java: "Java",
    cpp: "C++",
    c: "C",
    cs: "C#",
    csharp: "C#",
    php: "PHP",
    swift: "Swift",
    kotlin: "Kotlin",
    sql: "SQL",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    sass: "Sass",
    less: "Less",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    xml: "XML",
    md: "Markdown",
    markdown: "Markdown",
    bash: "Bash",
    sh: "Shell",
    shell: "Shell",
    zsh: "Zsh",
    powershell: "PowerShell",
    dockerfile: "Dockerfile",
    docker: "Docker",
    graphql: "GraphQL",
    vue: "Vue",
    svelte: "Svelte",
};

/**
 * CodeBlock - 代码块组件
 * 
 * 功能：
 * - 语法高亮（通过 rehype-highlight 提供）
 * - 一键复制代码
 * - 超过15行自动折叠
 * - 显示语言标签
 */
export const CodeBlock = memo(function CodeBlock({
    children,
    className = "",
    language = ""
}: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [lineCount, setLineCount] = useState(0);
    const codeRef = useRef<HTMLPreElement>(null);

    // 检测行数
    useEffect(() => {
        if (codeRef.current) {
            const codeElement = codeRef.current.querySelector("code");
            if (codeElement) {
                const text = codeElement.textContent || "";
                setLineCount(text.split("\n").length);
            }
        }
    }, [children]);

    const shouldCollapse = lineCount > MAX_COLLAPSED_LINES;

    // 解析并格式化语言名称
    const displayLanguage = useMemo(() => {
        // 清理 className 中的语言标识
        const rawLang = (language || className || "")
            .replace(/language-/g, "")
            .replace(/hljs/g, "")
            .trim()
            .toLowerCase();

        if (!rawLang) return "";

        return LANGUAGE_DISPLAY_NAMES[rawLang] || rawLang.toUpperCase();
    }, [language, className]);

    const handleCopy = async () => {
        const codeElement = codeRef.current?.querySelector("code");
        const text = codeElement?.textContent || "";

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy code:", err);
        }
    };

    return (
        <div className="code-block-wrapper relative my-3 rounded-lg overflow-hidden border border-gray-700/50">
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e]">
                {displayLanguage ? (
                    <span className="text-xs text-gray-400 font-medium tracking-wide">
                        {displayLanguage}
                    </span>
                ) : (
                    <span />
                )}
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-md transition-all duration-150"
                    title="复制代码"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-green-400">已复制</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>复制</span>
                        </>
                    )}
                </button>
            </div>

            {/* 代码内容 */}
            <pre
                ref={codeRef}
                className={`
                    m-0 p-4 overflow-x-auto text-[13px] leading-relaxed font-mono
                    bg-[#0d1117] text-[#c9d1d9]
                    ${shouldCollapse && !isExpanded ? "max-h-[400px] overflow-y-hidden" : ""}
                `}
            >
                {children}
            </pre>

            {/* 折叠渐变遮罩 */}
            {shouldCollapse && !isExpanded && (
                <div className="absolute bottom-10 left-0 right-0 h-20 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/80 to-transparent pointer-events-none" />
            )}

            {/* 展开/收起按钮 */}
            {shouldCollapse && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-2.5 bg-[#161b22] hover:bg-[#21262d] text-gray-400 hover:text-gray-200 text-xs flex items-center justify-center gap-1.5 transition-colors border-t border-gray-700/50"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            收起代码
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-4 h-4" />
                            展开全部 ({lineCount} 行)
                        </>
                    )}
                </button>
            )}
        </div>
    );
});
