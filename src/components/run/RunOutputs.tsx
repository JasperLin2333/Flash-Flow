"use client";
import { FileText } from "lucide-react";
import type { AppNode, FlowContext } from "@/types/flow";

type OutputAttachment = { name: string; url: string; type?: string; size?: number };

function isImageAttachment(att: OutputAttachment): boolean {
  if (att.type?.startsWith("image/")) return true;
  const url = att.url || "";
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

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
        const outputData = flowContext[node.id] as { text?: string; attachments?: OutputAttachment[] } | undefined;
        const textData = outputData?.text;
        const attachments = Array.isArray(outputData?.attachments) ? outputData?.attachments : [];
        return (
          <div key={node.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm space-y-2 transition-all duration-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <FileText className="w-4 h-4 text-gray-500" />
              {node.data.label || "Output"}
            </div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {textData ? textData : outputData ? JSON.stringify(outputData, null, 2) : "处理完成。"}
            </div>
            {attachments.length > 0 && (
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="text-xs font-medium text-gray-700">附件</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att, idx) => (
                    <a
                      key={`${att.url}-${idx}`}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 hover:bg-gray-100 transition-colors"
                    >
                      {isImageAttachment(att) ? (
                        <img
                          src={att.url}
                          alt={att.name}
                          className="h-12 w-12 rounded object-cover border border-gray-200 bg-white"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded border border-gray-200 bg-white flex items-center justify-center text-[10px] text-gray-500">
                          FILE
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-900 truncate group-hover:underline">
                          {att.name || "附件"}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">{att.url}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
