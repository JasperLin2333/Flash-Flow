"use client";

import { useState, useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { RAGNodeData, AppNode, AppNodeData } from "@/types/flow";
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
  const [showExtraFiles, setShowExtraFiles] = useState<number>(0);
  const [showExtraStaticSlots, setShowExtraStaticSlots] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
  // 处理文件上传（支持槽位）
  const handleFileUpload = async (files: FileList | null, slot: 1 | 2 | 3 = 1) => {
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
      const fileKey = slot === 1 ? 'files' : slot === 2 ? 'files2' : 'files3';
      const existingFiles = ragData[fileKey] || [];
      updateNodeData(selectedNodeId, {
        [fileKey]: [...existingFiles, ...uploadedFiles],
        uploadStatus: 'completed',
        uploadError: undefined
      });
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  // 删除文件（同步删除远程，支持槽位）
  const handleDeleteFile = async (fileName: string, slot: 1 | 2 | 3 = 1) => {
    if (!selectedNodeId) return;

    // 调用 API 删除远程文件
    try {
      await fetch("/api/rag/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName })
      });
    } catch (error) {
      console.warn("远程删除失败，仅本地删除:", error);
    }

    const fileKey = slot === 1 ? 'files' : slot === 2 ? 'files2' : 'files3';
    const currentFiles = (ragData[fileKey] || []).filter(f => f.name !== fileName);
    updateNodeData(selectedNodeId, { [fileKey]: currentFiles });
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



      {/* 知识库文件区域 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className={STYLES.LABEL}>知识库文件</div>
          {statusIcon}
        </div>

        {/* 模式切换 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedNodeId) {
                updateNodeData(selectedNodeId, { fileMode: 'variable' });
              }
            }}
            className={`flex-1 py-1.5 px-3 text-xs rounded-lg border transition-all ${ragData.fileMode === 'variable'
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
          >
            变量引用
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedNodeId) {
                updateNodeData(selectedNodeId, { fileMode: 'static' });
              }
            }}
            className={`flex-1 py-1.5 px-3 text-xs rounded-lg border transition-all ${ragData.fileMode !== 'variable'
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
          >
            静态上传
          </button>
        </div>

        {/* 变量引用模式 */}
        {ragData.fileMode === 'variable' ? (
          <div className="space-y-2" key="mode-variable">
            {/* 变量1 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-medium shrink-0">1.</span>
              <div className="relative flex-1">
                <input
                  value={ragData.inputMappings?.files || ""}
                  onChange={(e) => {
                    if (selectedNodeId) {
                      updateNodeData(selectedNodeId, {
                        inputMappings: {
                          ...ragData.inputMappings,
                          files: e.target.value
                        }
                      });
                    }
                  }}
                  placeholder="文件URL变量"
                  className="w-full text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono bg-white pr-7"
                />
                {ragData.inputMappings?.files && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNodeId) {
                        updateNodeData(selectedNodeId, {
                          inputMappings: {
                            ...ragData.inputMappings,
                            files: ""
                          }
                        });
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-sm">×</span>
                  </button>
                )}
              </div>
            </div>

            {/* 变量2 - 动态显示 */}
            {(ragData.inputMappings?.files2 || showExtraFiles >= 1) && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 font-medium shrink-0">2.</span>
                <div className="relative flex-1">
                  <input
                    value={ragData.inputMappings?.files2 || ""}
                    onChange={(e) => {
                      if (selectedNodeId) {
                        updateNodeData(selectedNodeId, {
                          inputMappings: {
                            ...ragData.inputMappings,
                            files2: e.target.value
                          }
                        });
                      }
                    }}
                    placeholder="文件URL变量"
                    className="w-full text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono bg-white pr-7"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNodeId) {
                        updateNodeData(selectedNodeId, {
                          inputMappings: {
                            ...ragData.inputMappings,
                            files2: ""
                          }
                        });
                      }
                      setShowExtraFiles(prev => Math.max(0, prev - 1));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-sm">×</span>
                  </button>
                </div>
              </div>
            )}

            {/* 变量3 - 动态显示 */}
            {(ragData.inputMappings?.files3 || showExtraFiles >= 2) && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 font-medium shrink-0">3.</span>
                <div className="relative flex-1">
                  <input
                    value={ragData.inputMappings?.files3 || ""}
                    onChange={(e) => {
                      if (selectedNodeId) {
                        updateNodeData(selectedNodeId, {
                          inputMappings: {
                            ...ragData.inputMappings,
                            files3: e.target.value
                          }
                        });
                      }
                    }}
                    placeholder="文件URL变量"
                    className="w-full text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono bg-white pr-7"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNodeId) {
                        updateNodeData(selectedNodeId, {
                          inputMappings: {
                            ...ragData.inputMappings,
                            files3: ""
                          }
                        });
                      }
                      setShowExtraFiles(prev => Math.max(0, prev - 1));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-sm">×</span>
                  </button>
                </div>
              </div>
            )}

            {/* 添加文件变量按钮 */}
            {(() => {
              const hasFile2 = ragData.inputMappings?.files2 || showExtraFiles >= 1;
              const hasFile3 = ragData.inputMappings?.files3 || showExtraFiles >= 2;
              const canAddMore = !hasFile2 || (!hasFile3 && hasFile2);

              return canAddMore ? (
                <button
                  type="button"
                  onClick={() => setShowExtraFiles(prev => Math.min(2, prev + 1))}
                  className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <span>+</span>
                  添加文件变量
                </button>
              ) : null;
            })()}

            <p className="text-[9px] text-gray-400">
              💡 引用上游节点的文件数组，支持多个来源合并检索
            </p>
          </div>
        ) : hasStore ? (
          /* 静态上传模式 - 多槽位 */
          <div className="space-y-3" key="mode-static">
            {/* 槽位1 */}
            <div className="space-y-2">
              <span className="text-[10px] text-gray-500 font-medium">1.</span>
              {/* 上传区域 - 有文件时隐藏 */}
              {!(ragData.files && ragData.files.length > 0) && (
                <div className={`${STYLES.FILE_AREA} hover:border-gray-400 hover:bg-gray-50 cursor-pointer py-3`}>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.doc,.docx"
                    className="hidden"
                    id="rag-file-input-1"
                    onChange={(e) => handleFileUpload(e.target.files, 1)}
                    disabled={isUploading}
                  />
                  <label htmlFor="rag-file-input-1" className="cursor-pointer block">
                    <div className="text-xs text-gray-500">
                      {isUploading ? `上传中... ${uploadProgress}%` : '点击上传文件'}
                    </div>
                  </label>
                </div>
              )}
              {/* 已上传文件列表 */}
              {ragData.files && ragData.files.length > 0 && (
                <div className="space-y-1">
                  {ragData.files.map((file) => (
                    <div key={file.name} className={STYLES.FILE_ITEM}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate text-xs">{file.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteFile(file.name, 1)}
                        className="text-red-500 hover:text-red-700 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 槽位2 - 动态显示 */}
            {((ragData.files2 && ragData.files2.length > 0) || showExtraStaticSlots >= 1) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-medium">2.</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNodeId) updateNodeData(selectedNodeId, { files2: [] });
                      setShowExtraStaticSlots(prev => Math.max(0, prev - 1));
                    }}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >×</button>
                </div>
                {/* 上传区域 - 有文件时隐藏 */}
                {!(ragData.files2 && ragData.files2.length > 0) && (
                  <div className={`${STYLES.FILE_AREA} hover:border-gray-400 hover:bg-gray-50 cursor-pointer py-3`}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md,.doc,.docx"
                      className="hidden"
                      id="rag-file-input-2"
                      onChange={(e) => handleFileUpload(e.target.files, 2)}
                      disabled={isUploading}
                    />
                    <label htmlFor="rag-file-input-2" className="cursor-pointer block">
                      <div className="text-xs text-gray-500">点击上传文件</div>
                    </label>
                  </div>
                )}
                {ragData.files2 && ragData.files2.length > 0 && (
                  <div className="space-y-1">
                    {ragData.files2.map((file) => (
                      <div key={file.name} className={STYLES.FILE_ITEM}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate text-xs">{file.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(file.name, 2)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 槽位3 - 动态显示 */}
            {((ragData.files3 && ragData.files3.length > 0) || showExtraStaticSlots >= 2) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-medium">3.</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNodeId) updateNodeData(selectedNodeId, { files3: [] });
                      setShowExtraStaticSlots(prev => Math.max(0, prev - 1));
                    }}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >×</button>
                </div>
                {/* 上传区域 - 有文件时隐藏 */}
                {!(ragData.files3 && ragData.files3.length > 0) && (
                  <div className={`${STYLES.FILE_AREA} hover:border-gray-400 hover:bg-gray-50 cursor-pointer py-3`}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md,.doc,.docx"
                      className="hidden"
                      id="rag-file-input-3"
                      onChange={(e) => handleFileUpload(e.target.files, 3)}
                      disabled={isUploading}
                    />
                    <label htmlFor="rag-file-input-3" className="cursor-pointer block">
                      <div className="text-xs text-gray-500">点击上传文件</div>
                    </label>
                  </div>
                )}
                {ragData.files3 && ragData.files3.length > 0 && (
                  <div className="space-y-1">
                    {ragData.files3.map((file) => (
                      <div key={file.name} className={STYLES.FILE_ITEM}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate text-xs">{file.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(file.name, 3)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 添加知识库按钮 */}
            {(() => {
              const hasSlot2 = (ragData.files2 && ragData.files2.length > 0) || showExtraStaticSlots >= 1;
              const hasSlot3 = (ragData.files3 && ragData.files3.length > 0) || showExtraStaticSlots >= 2;
              const canAddMore = !hasSlot2 || (!hasSlot3 && hasSlot2);

              return canAddMore ? (
                <button
                  type="button"
                  onClick={() => setShowExtraStaticSlots(prev => Math.min(2, prev + 1))}
                  className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <span>+</span>
                  添加知识库
                </button>
              ) : null;
            })()}

            {/* 上传错误提示 */}
            {ragData.uploadError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                {ragData.uploadError}
              </div>
            )}

            <p className="text-[9px] text-gray-400">
              💡 支持各种文件格式，单文件最大 100MB
            </p>
          </div>
        ) : null}
      </div>

      {/* 高级设置 - 可折叠 */}
      {hasStore && (
        <>
          <div className="border-t border-gray-100 my-2" />
          <div
            className="flex items-center justify-between cursor-pointer py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">高级设置</h4>
            {showAdvanced ? (
              <ChevronUp className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            )}
          </div>

          {showAdvanced && (
            <div className="mt-2 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel className={STYLES.LABEL}>分块大小</FormLabel>
                  <span className="text-xs text-gray-600 font-mono">{ragData.maxTokensPerChunk || 200}</span>
                </div>
                <Slider
                  value={[ragData.maxTokensPerChunk || 200]}
                  onValueChange={([value]) => selectedNodeId && updateNodeData(selectedNodeId, { maxTokensPerChunk: value })}
                  min={50}
                  max={500}
                  step={10}
                  className="w-full"
                />
                <p className="text-[9px] text-gray-400 mt-1">
                  文件以多大的单位切分/token
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel className={STYLES.LABEL}>重叠</FormLabel>
                  <span className="text-xs text-gray-600 font-mono">{ragData.maxOverlapTokens || 20}</span>
                </div>
                <Slider
                  value={[ragData.maxOverlapTokens || 20]}
                  onValueChange={([value]) => selectedNodeId && updateNodeData(selectedNodeId, { maxOverlapTokens: value })}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <p className="text-[9px] text-gray-400 mt-1">
                  分块可重叠部分的大小/token
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
