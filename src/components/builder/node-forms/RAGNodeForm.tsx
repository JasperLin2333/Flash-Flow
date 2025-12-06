"use client";

import { useState, useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RAGNodeData } from "@/types/flow";
import { geminiFileSearchAPI } from "@/services/geminiFileSearchAPI";
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

// ============ 样式常量 ============
const STYLES = {
  LABEL: "text-[10px] font-bold uppercase tracking-wider text-gray-500",
  INPUT: "bg-gray-50 border-gray-200 text-gray-900",
  FILE_AREA: "border-2 border-dashed border-gray-300 rounded-xl p-6 text-center transition-all duration-150",
  FILE_ITEM: "flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg",
} as const;

interface RAGNodeFormProps {
  form: any;
  selectedNodeId: string | null;
  updateNodeData: (id: string, data: any) => void;
  selectedNode: any;
}

export function RAGNodeForm({ form, selectedNodeId, updateNodeData, selectedNode }: RAGNodeFormProps) {
  const ragData = (selectedNode.data || {}) as RAGNodeData;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Auto-create File Search Store if not exists
  useEffect(() => {
    if (!ragData.fileSearchStoreName && selectedNodeId) {
      const autoStoreName = `store-${selectedNodeId.slice(0, 8)}-${Date.now()}`;

      geminiFileSearchAPI.createFileSearchStore(autoStoreName)
        .then((store) => {
          updateNodeData(selectedNodeId, {
            fileSearchStoreName: store.name,
            fileSearchStoreId: autoStoreName,
            uploadStatus: 'idle'
          });
        })
        .catch((error) => {
          console.error('Failed to auto-create file search store:', error);
          updateNodeData(selectedNodeId, {
            uploadStatus: 'error',
            uploadError: error instanceof Error ? error.message : String(error)
          });
        });
    }
  }, [selectedNodeId, ragData.fileSearchStoreName, updateNodeData]);

  // 处理文件上传
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedNodeId) return;

    const ragData = selectedNode.data as RAGNodeData;
    if (!ragData.fileSearchStoreName) {
      alert("请先创建 File Search Store");
      return;
    }

    setIsUploading(true);
    const uploadedFiles: { name: string; size?: number; type?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        updateNodeData(selectedNodeId, { uploadStatus: 'uploading' });

        await geminiFileSearchAPI.uploadToFileSearchStore(
          file,
          ragData.fileSearchStoreName,
          {
            displayName: file.name,
            maxTokensPerChunk: ragData.maxTokensPerChunk || 200,
            maxOverlapTokens: ragData.maxOverlapTokens || 20,
            onProgress: (progress) => {
              setUploadProgress(progress.progress || 0);
              updateNodeData(selectedNodeId, { uploadStatus: progress.status });
            }
          }
        );

        uploadedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        updateNodeData(selectedNodeId, {
          uploadStatus: 'error',
          uploadError: errorMsg
        });
        alert(`文件 "${file.name}" 上传失败: ${errorMsg} `);
        break;
      }
    }

    if (uploadedFiles.length > 0) {
      const existingFiles = ragData.files || [];
      updateNodeData(selectedNodeId, {
        files: [...existingFiles, ...uploadedFiles],
        uploadStatus: 'completed',
        uploadError: undefined
      });
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  // 删除文件
  const handleDeleteFile = (index: number) => {
    if (!selectedNodeId) return;
    const currentFiles = [...(ragData.files || [])];
    currentFiles.splice(index, 1);
    updateNodeData(selectedNodeId, { files: currentFiles });
  };

  const hasStore = Boolean(ragData.fileSearchStoreName);
  const statusIcon = {
    idle: null,
    uploading: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />,
    processing: <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />
  }[ragData.uploadStatus || 'idle'];

  return (
    <>
      {/* 节点名称 */}
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={STYLES.LABEL}>节点名称</FormLabel>
            <FormControl>
              <Input {...field} className={`font - medium ${STYLES.INPUT} `} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />



      {/* 文件上传区域 */}
      {hasStore && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className={STYLES.LABEL}>知识库文件</div>
            {statusIcon}
          </div>

          <div className={`${STYLES.FILE_AREA} ${!hasStore ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 hover:bg-gray-50 cursor-pointer'} `}>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.doc,.docx"
              className="hidden"
              id="rag-file-input"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={!hasStore || isUploading}
            />
            <label htmlFor="rag-file-input" className="cursor-pointer block">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="text-sm font-medium text-gray-600">
                {isUploading ? `上传中... ${uploadProgress}% ` : '点击上传文件'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                支持 PDF, TXT, MD, DOC, DOCX（最大 100MB）
              </div>
            </label>
          </div>

          {/* 上传错误提示 */}
          {ragData.uploadError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {ragData.uploadError}
            </div>
          )}

          {/* 已上传文件列表 */}
          {ragData.files && ragData.files.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">已上传文件 ({ragData.files.length})</div>
              {ragData.files.map((file, idx) => (
                <div key={idx} className={STYLES.FILE_ITEM}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="truncate text-xs font-medium">{file.name}</span>
                    {file.size && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {Math.round(file.size / 1024)} KB
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteFile(idx)}
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                    aria-label="删除文件"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 分块配置 */}
      {hasStore && (
        <>
          <div className="space-y-2">
            <FormLabel className={STYLES.LABEL}>分块大小 (文件以多大的单位切分，单位为 token)</FormLabel>
            <Slider
              value={[ragData.maxTokensPerChunk || 200]}
              onValueChange={([value]) => selectedNodeId && updateNodeData(selectedNodeId, { maxTokensPerChunk: value })}
              min={50}
              max={500}
              step={10}
              className="w-full"
            />
            <div className="text-xs text-gray-500 text-right">{ragData.maxTokensPerChunk || 200}</div>
          </div>

          <div className="space-y-2">
            <FormLabel className={STYLES.LABEL}>重叠 (分块可重叠部分的大小，单位为 token)</FormLabel>
            <Slider
              value={[ragData.maxOverlapTokens || 20]}
              onValueChange={([value]) => selectedNodeId && updateNodeData(selectedNodeId, { maxOverlapTokens: value })}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="text-xs text-gray-500 text-right">{ragData.maxOverlapTokens || 20}</div>
          </div>

          <div className="space-y-2">
            <FormLabel className={STYLES.LABEL}>返回结果数 (返回最相关的前 K 个结果)</FormLabel>
            <Select
              value={String(ragData.topK || 5)}
              onValueChange={(value) => selectedNodeId && updateNodeData(selectedNodeId, { topK: parseInt(value) })}
            >
              <SelectTrigger className={STYLES.INPUT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 3, 5, 7, 10].map(k => (
                  <SelectItem key={k} value={String(k)}>
                    {k} 个结果
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </>
  );
}
