"use client";
import type { AppNode, InputNodeData } from "@/types/flow";
import { useFlowStore } from "@/store/flowStore";
import { InputBar } from "./InputBar";
import { fileUploadService } from "@/services/fileUploadService";

export default function RunInputs({ inputNodes }: { inputNodes: AppNode[] }) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const handleInputSend = async (
    nodeId: string,
    data: { text: string; files?: File[]; formData?: Record<string, unknown> }
  ) => {
    const currentFlowId = useFlowStore.getState().currentFlowId;

    // 上传文件并获取 URL（与 AppModeOverlay.tsx 保持一致）
    let uploadedFiles: { name: string; size: number; type: string; url: string }[] = [];
    if (data.files && data.files.length > 0 && currentFlowId) {
      try {
        const uploadPromises = data.files.map(async (file) => {
          const result = await fileUploadService.uploadFile(file, nodeId, currentFlowId);
          if (result) {
            return {
              name: file.name,
              size: file.size,
              type: file.type,
              url: result.url,
            };
          }
          return null;
        });
        const results = await Promise.all(uploadPromises);
        uploadedFiles = results.filter((f): f is NonNullable<typeof f> => f !== null);
      } catch (error) {
        console.error("文件上传失败:", error);
      }
    }

    // Update node data with all collected information
    updateNodeData(nodeId, {
      text: data.text,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
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
              onFormDataChange={(formData) => updateNodeData(node.id, { formData })}
            />
          </div>
        );
      })}
    </>
  );
}
