"use client";
import type { AppNode, InputNodeData } from "@/types/flow";
import { useFlowStore } from "@/store/flowStore";
import { InputBar } from "./InputBar";

export default function RunInputs({ inputNodes }: { inputNodes: AppNode[] }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const handleInputSend = (
    nodeId: string,
    data: { text: string; files?: File[]; formData?: Record<string, unknown> }
  ) => {
    // Update node data with all collected information
    updateNodeData(nodeId, {
      text: data.text,
      files: data.files?.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
      formData: data.formData,
    });
  };

  return (
    <>
      {inputNodes.map((node) => {
        const inputData = node.data as InputNodeData;

        return (
          <div key={node.id} className="space-y-3">
            <label className="text-sm font-semibold text-gray-900">
              {node.data.label || "Input"}
            </label>
            <InputBar
              inputNode={inputData}
              value={inputData.text || ""}
              onChange={(value) => updateNodeData(node.id, { text: value })}
              onSend={(data) => handleInputSend(node.id, data)}
            />
          </div>
        );
      })}
    </>
  );
}
