import React from "react";
import { LABEL_CLASS } from "./constants";

interface ExecutionOutputProps {
    executionOutput: unknown;
}

export function ExecutionOutput({ executionOutput }: ExecutionOutputProps) {
    if (!executionOutput) return null;

    const data = executionOutput as Record<string, unknown>;
    const hasReasoning = typeof data.reasoning === "string" && data.reasoning.trim();
    const hasResponse = typeof data.response === "string" && data.response.trim();

    return (
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

                {/* Main Response or Generic JSON */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-96 overflow-auto">
                    {hasResponse ? (
                        <div className="text-xs font-sans text-gray-800 whitespace-pre-wrap break-all leading-normal">
                            {data.response as string}
                        </div>
                    ) : (
                        <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all">
                            {JSON.stringify(executionOutput, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
}
