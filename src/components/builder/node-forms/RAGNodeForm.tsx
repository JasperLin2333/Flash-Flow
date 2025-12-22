"use client";

import { useState, useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { RAGNodeData, AppNode, AppNodeData } from "@/types/flow";
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { showError, showWarning } from "@/utils/errorNotify";
import { NODE_FORM_STYLES, type ExtendedNodeFormProps } from "./shared";

// ============ 样式常量 ============
const STYLES = {
  ...NODE_FORM_STYLES,
  FILE_AREA: "border-2 border-dashed border-gray-300 rounded-xl p-6 text-center transition-all duration-150",
  FILE_ITEM: "flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg",
} as const;

interface RAGNodeFormProps extends ExtendedNodeFormProps {
  /** RAG 节点需要完整的节点对象 */
  selectedNode: AppNode;
}

/**
 * 通过服务端 API 创建 FileSearchStore
 */
async function createFileSearchStoreViaAPI(displayName: string): Promise<{ name: string; displayName?: string }> {
  const response = await fetch("/api/rag/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `创建 Store 失败: ${response.status}`);
  }

  return response.json();
}

/**
 * 通过服务端 API 上传文件到 FileSearchStore
 */
async function uploadToFileSearchStoreViaAPI(
  file: File,
  fileSearchStoreName: string,
  options?: {
    displayName?: string;
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
    onProgress?: (progress: { status: string; progress?: number }) => void;
  }
): Promise<{ name: string; displayName: string; sizeBytes: number }> {
  options?.onProgress?.({ status: 'uploading', progress: 0 });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileSearchStoreName', fileSearchStoreName);
  if (options?.displayName) {
    formData.append('displayName', options.displayName);
  }
  formData.append('maxTokensPerChunk', String(options?.maxTokensPerChunk || 200));
  formData.append('maxOverlapTokens', String(options?.maxOverlapTokens || 20));

  options?.onProgress?.({ status: 'processing', progress: 50 });

  const response = await fetch("/api/rag/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    options?.onProgress?.({ status: 'error', progress: 0 });
    throw new Error(errorData.error || `上传失败: ${response.status}`);
  }

  options?.onProgress?.({ status: 'completed', progress: 100 });

  return response.json();
}

export function RAGNodeForm({ form, selectedNodeId, updateNodeData, selectedNode }: RAGNodeFormProps) {
  const ragData = (selectedNode.data || {}) as RAGNodeData;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Auto-create File Search Store if not exists
  useEffect(() => {
    if (!ragData.fileSearchStoreName && selectedNodeId) {
      const autoStoreName = `store-${selectedNodeId.slice(0, 8)}-${Date.now()}`;

      createFileSearchStoreViaAPI(autoStoreName)
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
      showWarning("知识库未初始化", "请稍等，File Search Store 正在创建中...");
      return;
    }

    setIsUploading(true);
    const uploadedFiles: { name: string; size?: number; type?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        updateNodeData(selectedNodeId, { uploadStatus: 'uploading' });

        await uploadToFileSearchStoreViaAPI(
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
        showError("文件上传失败", `文件 "${file.name}" 上传失败: ${errorMsg}`);
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
  const handleDeleteFile = (fileName: string) => {
    if (!selectedNodeId) return;
    const currentFiles = (ragData.files || []).filter(f => f.name !== fileName);
    updateNodeData(selectedNodeId, { files: currentFiles });
  };

  const hasStore = Boolean(ragData.fileSearchStoreName);
  const statusIcon = {
    idle: null,
    uploading: <Loader2 className="w-4 h-4 animate-spin text-gray-500" />,
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
              <Input {...field} className={`font-medium ${STYLES.INPUT}`} />
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
                {isUploading ? `上传中... ${uploadProgress}% ` : '点击上传文件（知识库）'}
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
              {ragData.files.map((file) => (
                <div key={file.name} className={STYLES.FILE_ITEM}>
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
                    onClick={() => handleDeleteFile(file.name)}
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
        </>
      )}
    </>
  );
}
