"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { RAGNodeData } from "@/types/flow";

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

interface RAGNodeFormProps {
  form: any;
  selectedNodeId: string | null;
  updateNodeData: (id: string, data: any) => void;
  selectedNode: any;
}

export function RAGNodeForm({ form, selectedNodeId, updateNodeData, selectedNode }: RAGNodeFormProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={LABEL_CLASS}>节点名称</FormLabel>
            <FormControl>
              <Input {...field} className={`font-medium ${INPUT_CLASS}`} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-2">
        <div className={`${LABEL_CLASS} mb-2`}>知识库文件</div>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-all duration-150 cursor-pointer">
          <input
            type="file"
            multiple
            className="hidden"
            id="rag-file-input"
            onChange={(e) => {
              const files = Array.from(e.target.files || []).map((f) => ({ 
                name: f.name, 
                size: f.size, 
                type: f.type 
              }));
              selectedNodeId && updateNodeData(selectedNodeId, { files });
            }}
          />
          <label htmlFor="rag-file-input" className="cursor-pointer text-xs">
            点击上传或拖拽文件到此
          </label>
        </div>
        {((selectedNode.data || {}) as RAGNodeData)?.files?.length ? (
          <div className="space-y-1 text-xs text-gray-600">
            {(((selectedNode.data || {}) as RAGNodeData).files || []).map((f, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="truncate max-w-[180px]">{f.name}</span>
                <span className="text-gray-400">
                  {typeof f.size === "number" ? Math.round(f.size / 1024) + " KB" : ""}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
