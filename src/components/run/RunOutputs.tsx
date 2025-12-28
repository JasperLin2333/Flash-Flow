"use client";
import { FileText } from "lucide-react";
import type { AppNode, FlowContext } from "@/types/flow";

export default function RunOutputs({ outputNodes, flowContext }: { outputNodes: AppNode[]; flowContext: FlowContext }) {
  return (
    <>
      {outputNodes.map((node) => {
        const outputData = flowContext[node.id] as { text?: string } | undefined;
        // Read text from flowContext (single source of truth)
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
