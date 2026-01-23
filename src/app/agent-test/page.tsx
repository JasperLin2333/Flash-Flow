"use client";

import { useState, useRef } from "react";

interface SSEEvent {
    type: string;
    content?: string;
    tool?: string;
    args?: unknown;
    result?: unknown;
    nodes?: unknown[];
    edges?: unknown[];
    warnings?: string[];
    title?: string;
    scenario?: string;  // Phase 3: Intent scenario
}

export default function AgentTestPage() {
    const [prompt, setPrompt] = useState("创建一个简单的翻译工作流");
    const [events, setEvents] = useState<SSEEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingContent, setThinkingContent] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const eventsEndRef = useRef<HTMLDivElement>(null);

    const testAgent = async () => {
        setEvents([]);
        setIsLoading(true);
        setThinkingContent("");
        setIsThinking(false);

        try {
            const response = await fetch("/api/agent/plan", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-flash-test-user": "true",
                },
                body: JSON.stringify({ prompt }),
            });

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") continue;

                        try {
                            const event = JSON.parse(data) as SSEEvent;

                            // Handle thinking events
                            if (event.type === "thinking-start") {
                                setIsThinking(true);
                            } else if (event.type === "thinking") {
                                setThinkingContent(event.content || "");
                            } else if (event.type === "thinking-end") {
                                setIsThinking(false);
                            }

                            // Skip progress events for cleaner display
                            if (event.type !== "progress") {
                                setEvents(prev => [...prev, event]);
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error:", error);
            setEvents(prev => [...prev, {
                type: "error",
                content: error instanceof Error ? error.message : "Unknown error"
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const getEventColor = (type: string) => {
        switch (type) {
            case "thinking-start":
            case "thinking":
            case "thinking-end":
                return "bg-purple-100 border-purple-300";
            case "tool-call":
                return "bg-blue-100 border-blue-300";
            case "tool-result":
                return "bg-green-100 border-green-300";
            case "result":
                return "bg-emerald-100 border-emerald-300";
            case "suggestion":
                return "bg-amber-100 border-amber-300";
            case "error":
                return "bg-red-100 border-red-300";
            default:
                return "bg-gray-100 border-gray-300";
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">🧪 Agent Test Page</h1>
                <p className="text-gray-600 mb-8">Phase 3: 测试主动建议和意图分析</p>

                {/* Input Section */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <label className="block text-sm font-medium mb-2">Prompt</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full p-3 border rounded-lg resize-none h-24"
                        placeholder="输入工作流需求..."
                    />
                    <button
                        onClick={testAgent}
                        disabled={isLoading}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? "⏳ 生成中..." : "🚀 测试 Agent"}
                    </button>
                </div>

                {/* Thinking Section */}
                {(isThinking || thinkingContent) && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">🧠</span>
                            <span className="font-medium text-purple-800">Agent 正在思考...</span>
                            {isThinking && <span className="animate-pulse">●</span>}
                        </div>
                        <pre className="text-sm text-purple-700 whitespace-pre-wrap">
                            {thinkingContent || "分析需求中..."}
                        </pre>
                    </div>
                )}

                {/* Events Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">📦 SSE 事件流</h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {events.length === 0 ? (
                            <p className="text-gray-400">点击测试按钮开始...</p>
                        ) : (
                            events.map((event, i) => (
                                <div
                                    key={i}
                                    className={`p-3 rounded border ${getEventColor(event.type)}`}
                                >
                                    <div className="font-mono text-sm font-semibold mb-1">
                                        {event.type}
                                        {event.tool && ` → ${event.tool}`}
                                    </div>
                                    {event.type === "result" && (
                                        <div className="text-sm">
                                            <p>📊 Nodes: {event.nodes?.length || 0}</p>
                                            <p>🔗 Edges: {event.edges?.length || 0}</p>
                                            {event.warnings && event.warnings.length > 0 && (
                                                <p className="text-amber-600">⚠️ Warnings: {event.warnings.length}</p>
                                            )}
                                        </div>
                                    )}
                                    {event.type === "tool-result" ? (
                                        <pre className="text-xs mt-1 overflow-x-auto">
                                            {JSON.stringify(event.result ?? {}, null, 2)}
                                        </pre>
                                    ) : null}
                                    {event.type === "error" && (
                                        <p className="text-red-600">{event.content}</p>
                                    )}
                                    {event.type === "suggestion" && (
                                        <div className="text-sm text-amber-800">
                                            {event.scenario && (
                                                <p className="font-medium mb-1">🎯 场景: {event.scenario}</p>
                                            )}
                                            <pre className="whitespace-pre-wrap">💡 {event.content}</pre>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <div ref={eventsEndRef} />
                    </div>
                </div>

                {/* Result Summary */}
                {events.find(e => e.type === "result") && (
                    <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <h3 className="font-semibold text-emerald-800 mb-2">✅ 生成完成</h3>
                        {(() => {
                            const result = events.find(e => e.type === "result");
                            return result ? (
                                <div className="text-sm text-emerald-700">
                                    <p>标题: {result.title || "无"}</p>
                                    <p>节点数: {result.nodes?.length || 0}</p>
                                    <p>边数: {result.edges?.length || 0}</p>
                                </div>
                            ) : null;
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
