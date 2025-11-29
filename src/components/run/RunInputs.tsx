"use client";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import type { AppNode, InputNodeData } from "@/types/flow";
import { useFlowStore } from "@/store/flowStore";

export default function RunInputs({ inputNodes }: { inputNodes: AppNode[] }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  return (
    <>
      {inputNodes.map((node) => (
        <div key={node.id} className="space-y-2">
          <label className="text-sm font-semibold text-gray-900">{node.data.label || "Input"}</label>
          {(String(node.data.label || "")).toLowerCase().includes("file") ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-all duration-150 cursor-pointer">
              <Upload className="w-6 h-6" />
              <span className="text-xs">拖拽文件到此或点击上传</span>
            </div>
          ) : (
            (() => {
              const d = node.data as InputNodeData;
              const val = String(d.text || "");
              return (
            <Textarea
              placeholder={val ? undefined : "输入文本…"}
              value={val}
              onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
              className="min-h-[100px] resize-none bg-gray-50 border-gray-200 text-gray-900 focus:border-black focus:ring-black/5 transition-colors duration-150"
            />
              );
            })()
          )}
        </div>
      ))}
    </>
  );
}
