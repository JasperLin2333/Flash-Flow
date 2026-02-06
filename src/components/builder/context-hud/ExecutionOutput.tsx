import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Download, X, Terminal, Sparkles, AlertCircle } from "lucide-react";
import { CapabilityItem } from "../node-forms/shared";

interface ExecutionOutputProps {
    executionOutput: unknown;
}

export function ExecutionOutput({ executionOutput }: ExecutionOutputProps) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    if (!executionOutput) return null;

    const data = executionOutput as Record<string, unknown>;
    const hasReasoning = typeof data.reasoning === "string" && data.reasoning.trim();
    const hasResponse = data.response !== undefined && data.response !== null && data.response !== "";
    const isStructuredResponse = typeof data.response === "object" && data.response !== null;
    const hasImageUrl = typeof data.imageUrl === "string" && data.imageUrl.trim();
    const imageUrl = data.imageUrl as string;
    const status = data.status as string || 'completed'; // Default to completed if we have output
    const debug = data.debug as unknown[] | undefined;
    const hasDebug = Array.isArray(debug) && debug.length > 0;

    // Handle download
    const handleDownload = async () => {
        if (!imageUrl) return;
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `generated_image_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            window.open(imageUrl, "_blank");
        }
    };

    // Preview Modal
    const previewModal = previewOpen && hasImageUrl && typeof document !== "undefined" ? createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setPreviewOpen(false)}
        >
            <div className="relative max-w-[90vw] max-h-[90vh] animate-in zoom-in-95 duration-200">
                <img
                    src={imageUrl}
                    alt="Generated image preview"
                    className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                />
                <button
                    onClick={() => setPreviewOpen(false)}
                    className="absolute -top-4 -right-4 p-2 rounded-full bg-white text-black hover:bg-gray-200 transition-colors shadow-lg"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full px-5 py-2.5 shadow-xl">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownload();
                        }}
                        className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        下载图片
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <div className="mt-6 pt-2 border-t border-gray-100/50">
                 <CapabilityItem
                    icon={status === 'error' ? <AlertCircle className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                    iconColorClass={status === 'error' ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-700"}
                    title="执行结果 (Console)"
                    description={status === 'error' ? "执行遇到错误" : "查看节点运行输出"}
                    isExpanded={isExpanded}
                    rightElement={
                        <div className="flex items-center gap-2">
                             {status === 'completed' && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">SUCCESS</span>}
                             <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                            >
                                {isExpanded ? "收起" : "展开"}
                            </button>
                        </div>
                    }
                >
                    <div className="flex flex-col gap-4 pt-2 pb-1 px-1">
                        {/* Reasoning (Chain of Thought) */}
                        {hasReasoning && (
                            <div className="relative bg-amber-50/40 rounded-xl p-4 border border-amber-100/60 overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-amber-300/50" />
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">思考过程</span>
                                </div>
                                <div className="text-[11px] font-mono text-amber-800/80 leading-relaxed whitespace-pre-wrap break-all">
                                    {data.reasoning as string}
                                </div>
                            </div>
                        )}

                        {/* Debug (Tool/Skill) */}
                        {hasDebug && (
                            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/50">
                                    <span className="text-[10px] text-slate-500 font-mono">DEBUG</span>
                                </div>
                                <div className="p-4 max-h-64 overflow-auto custom-scrollbar-dark">
                                    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                                        {JSON.stringify(debug, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* Image Preview */}
                        {hasImageUrl && (
                            <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 rounded-xl p-1 border border-purple-100/50 shadow-sm">
                                <div className="relative rounded-lg overflow-hidden bg-white group border border-gray-100">
                                    <img
                                        src={imageUrl}
                                        alt="Generated image"
                                        className="w-full h-auto max-h-72 object-contain cursor-zoom-in transition-transform duration-500 group-hover:scale-[1.01]"
                                        loading="lazy"
                                        onClick={() => setPreviewOpen(true)}
                                    />
                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                        <button
                                            onClick={() => setPreviewOpen(true)}
                                            className="p-2 rounded-lg bg-white/90 backdrop-blur text-gray-700 hover:text-indigo-600 shadow-sm hover:shadow-md transition-all"
                                            title="预览"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="p-2 rounded-lg bg-white/90 backdrop-blur text-gray-700 hover:text-indigo-600 shadow-sm hover:shadow-md transition-all"
                                            title="下载"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-md text-[10px] font-medium text-gray-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                        GENERATED IMAGE
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Main Response or Generic JSON */}
                        {(hasResponse || !hasImageUrl) && (
                            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/50">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">OUTPUT</span>
                                </div>
                                <div className="p-4 max-h-96 overflow-auto custom-scrollbar-dark">
                                    {hasResponse ? (
                                        isStructuredResponse ? (
                                            <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap break-all">
                                                {JSON.stringify(data.response, null, 2)}
                                            </pre>
                                        ) : (
                                            <div className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
                                                {data.response as string}
                                            </div>
                                        )
                                    ) : (
                                        <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-all">
                                            {JSON.stringify(executionOutput, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </CapabilityItem>
            </div>

            {/* Render modal via Portal */}
            {previewModal}
        </>
    );
}
