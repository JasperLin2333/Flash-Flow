"use client";
import { FileText } from "lucide-react";
import type { AppNode, FlowContext } from "@/types/flow";

export default function RunOutputs({ outputNodes, flowContext }: { outputNodes: AppNode[]; flowContext: FlowContext }) {
  return (
    <>
      {outputNodes.map((node) => {
        /**
         * 注意：这里的 text 是 OutputNodeExecutor 的执行结果输出字段，
         * 存储在 flowContext[nodeId].text 中，而非 OutputNodeData.text（已废弃）。
         * 
         * 执行器输出格式: { text: string; attachments?: {...}[] }
         * 详见 OutputNodeExecutor.ts Line 233
         */
        const outputData = flowContext[node.id] as { text?: string } | undefined;
        const textData = outputData?.text;
        return (
          <div key={node.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm space-y-2 transition-all duration-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <FileText className="w-4 h-4 text-gray-500" />
              {node.data.label || "Output"}
            </div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {textData ? textData : outputData ? JSON.stringify(outputData, null, 2) : "处理完成。"}
            </div>
          </div>
        );
      })}
    </>
  );
}
