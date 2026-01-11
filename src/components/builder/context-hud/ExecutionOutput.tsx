import React, { useState } from "react";
import { createPortal } from "react-dom";
import { LABEL_CLASS } from "./constants";
import { Eye, Download, X } from "lucide-react";

interface ExecutionOutputProps {
    executionOutput: unknown;
}

export function ExecutionOutput({ executionOutput }: ExecutionOutputProps) {
    const [previewOpen, setPreviewOpen] = useState(false);

    if (!executionOutput) return null;

    const data = executionOutput as Record<string, unknown>;
    const hasReasoning = typeof data.reasoning === "string" && data.reasoning.trim();
    const hasResponse = data.response !== undefined && data.response !== null && data.response !== "";
    const isStructuredResponse = typeof data.response === "object" && data.response !== null;
    const hasImageUrl = typeof data.imageUrl === "string" && data.imageUrl.trim();
    const imageUrl = data.imageUrl as string;

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
        } catch (error) {
            // Fallback: open in new tab
            window.open(imageUrl, "_blank");
        }
    };

    // Preview Modal Component - rendered via Portal
    const previewModal = previewOpen && hasImageUrl && typeof document !== "undefined" ? createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewOpen(false)}
        >
            <div className="relative max-w-[90vw] max-h-[90vh]">
                <img
                    src={imageUrl}
                    alt="Generated image preview"
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                />
                {/* Close button */}
                <button
                    onClick={() => setPreviewOpen(false)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>
                {/* Bottom toolbar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm rounded-full px-4 py-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownload();
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
    ) : null;

    return (
        <>
            <div className="mt-8 pt-5 border-t border-gray-100">
                <h4 className={`${LABEL_CLASS} mb-3`}>执行结果</h4>

                <div className="flex flex-col gap-4">
                    {/* Reasoning (Chain of Thought) */}
                    {hasReasoning && (
                        <div className="bg-amber-50/30 rounded-xl p-3 border border-amber-100/50">
                            <div className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter mb-1 select-none">想思维过程 (Thinking)</div>
                            <div className="text-[10px] font-mono text-amber-700/80 italic whitespace-pre-wrap break-all leading-relaxed">
                                {data.reasoning as string}
                            </div>
                        </div>
                    )}

                    {/* Image Preview for ImageGen nodes */}
                    {hasImageUrl && (
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
                            <div className="text-[9px] font-bold text-purple-600 uppercase tracking-tighter mb-2 select-none">生成图片</div>
                            <div className="relative rounded-lg overflow-hidden border border-purple-200 bg-white group">
                                <img
                                    src={imageUrl}
                                    alt="Generated image"
                                    className="w-full h-auto max-h-64 object-contain cursor-pointer transition-transform hover:scale-[1.02]"
                                    loading="lazy"
                                    onClick={() => setPreviewOpen(true)}
                                />
                                {/* Toolbar - top right corner */}
                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-gray-900/90 backdrop-blur-sm rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setPreviewOpen(true)}
                                        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                                        title="预览"
                                    >
                                        <Eye className="w-4 h-4 text-white" />
                                    </button>
                                    <div className="w-px h-4 bg-white/30" />
                                    <button
                                        onClick={handleDownload}
                                        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                                        title="下载"
                                    >
                                        <Download className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Response or Generic JSON */}
                    {(hasResponse || !hasImageUrl) && (
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-96 overflow-auto">
                            {hasResponse ? (
                                isStructuredResponse ? (
                                    <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all">
                                        {JSON.stringify(data.response, null, 2)}
                                    </pre>
                                ) : (
                                    <div className="text-xs font-sans text-gray-800 whitespace-pre-wrap break-all leading-normal">
                                        {data.response as string}
                                    </div>
                                )
                            ) : (
                                <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all">
                                    {JSON.stringify(executionOutput, null, 2)}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Render modal via Portal to escape stacking context */}
            {previewModal}
        </>
    );
}
