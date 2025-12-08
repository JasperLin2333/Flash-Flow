import React from "react";
import { LABEL_CLASS } from "./constants";

interface ExecutionOutputProps {
    executionOutput: unknown;
}

export function ExecutionOutput({ executionOutput }: ExecutionOutputProps) {
    if (!executionOutput) return null;

    return (
        <div className="mt-8 pt-5 border-t border-gray-100">
            <h4 className={`${LABEL_CLASS} mb-3`}>最近一次执行输出</h4>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-64 overflow-auto">
                <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all">
                    {JSON.stringify(executionOutput, null, 2)}
                </pre>
            </div>
        </div>
    );
}
