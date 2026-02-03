"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { RAGNodeData, AppNode } from "@/types/flow";
import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Database, Settings2, FolderOpen, Braces, CloudUpload, Variable, MessageSquare } from "lucide-react";
import { showError, showWarning } from "@/utils/errorNotify";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NODE_FORM_STYLES, type ExtendedNodeFormProps, CapabilityItem } from "./shared";

// ============ 样式常量 ============
const STYLES = {
  ...NODE_FORM_STYLES,
  // RAG Specific Styles
  FILE_AREA: "relative border border-dashed border-indigo-200/70 bg-indigo-50/20 hover:bg-indigo-50/40 rounded-xl p-6 text-center transition-all duration-300 group cursor-pointer overflow-hidden",
  FILE_ITEM: "group flex items-center justify-between p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200",
  TAB_ACTIVE: "text-indigo-600 bg-white shadow-sm ring-1 ring-gray-200/50 font-semibold",
  TAB_INACTIVE: "text-gray-500 hover:text-gray-700 hover:bg-gray-50/50 font-medium",
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

  // 1. 提交上传任务
  const response = await fetch("/api/rag/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    options?.onProgress?.({ status: 'error', progress: 0 });
    throw new Error(errorData.error || `上传提交失败: ${response.status}`);
  }

  const uploadData = await response.json();
  const { operationName, uniqueDisplayName, done, result } = uploadData;

  // 如果小文件已经处理完成，直接返回
  if (done && result) {
      options?.onProgress?.({ status: 'completed', progress: 100 });
      return {
          name: result.name,
          displayName: result.displayName,
          sizeBytes: file.size
      };
  }

  if (!operationName) {
    throw new Error("未获取到上传任务 ID");
  }

  // 2. 轮询任务状态
  options?.onProgress?.({ status: 'processing', progress: 10 });
  
  const POLL_INTERVAL = 1000;
  const MAX_ATTEMPTS = 60; // ~1 minute is enough for small/medium files

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const statusRes = await fetch("/api/rag/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          operationName,
          displayName: uniqueDisplayName || options?.displayName || file.name
        })
      });

      if (!statusRes.ok) {
          const errData = await statusRes.json().catch(() => ({}));
          throw new Error(errData.error || `状态检查失败: ${statusRes.status}`);
      }

      const statusData = await statusRes.json();

      if (statusData.error) {
        throw new Error(`处理失败: ${statusData.error.message || "未知错误"}`);
      }

      if (statusData.done) {
        options?.onProgress?.({ status: 'completed', progress: 100 });
        return {
          name: statusData.result.name,
          displayName: statusData.result.displayName,
          sizeBytes: file.size
        };
      }

      // 模拟进度增长 (非线性：前 10 次快，后面慢)
      let simulatedProgress;
      if (i < 10) {
          simulatedProgress = 10 + (i + 1) * 5; // 10% -> 60%
      } else {
          simulatedProgress = 60 + Math.min(30, (i - 10) * 1); // 60% -> 90%
      }
      options?.onProgress?.({ status: 'processing', progress: simulatedProgress });

    } catch (e) {
      console.error("RAG upload polling error:", e);
      // 如果是明确的业务错误或 API 错误，直接中断不重试
      throw e;
    }

    // 放在末尾，确保第一次请求是立即发出的
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error("文件处理超时，请稍后重试");
}

export function RAGNodeForm({ form, selectedNodeId, updateNodeData, selectedNode }: RAGNodeFormProps) {
  const ragData = (selectedNode.data || {}) as RAGNodeData;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showExtraFiles, setShowExtraFiles] = useState<number>(0);
  const [showExtraStaticSlots, setShowExtraStaticSlots] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const watchedFiles2 = useWatch({ control: form.control, name: "inputMappings.files2" });
  const watchedFiles3 = useWatch({ control: form.control, name: "inputMappings.files3" });
  const initialQuery = String(ragData.inputMappings?.query || "");
  const [draftQuery, setDraftQuery] = useState<string>(initialQuery);
  const queryDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushQueryToForm = useCallback((nextQuery: string, shouldDirty: boolean) => {
    if (queryDebounceTimerRef.current) {
      clearTimeout(queryDebounceTimerRef.current);
      queryDebounceTimerRef.current = null;
    }
    const current = String(form.getValues("inputMappings.query") || "");
    if (current !== nextQuery) {
      form.setValue("inputMappings.query", nextQuery, { shouldDirty });
    }
  }, [form]);

  useEffect(() => {
    setDraftQuery(initialQuery);
    if (queryDebounceTimerRef.current) {
      clearTimeout(queryDebounceTimerRef.current);
      queryDebounceTimerRef.current = null;
    }
  }, [selectedNodeId, initialQuery]);

  useEffect(() => {
    return () => {
      if (queryDebounceTimerRef.current) {
        clearTimeout(queryDebounceTimerRef.current);
        queryDebounceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const inputMappings = ragData.inputMappings || {};
    const nextFiles = inputMappings.files || "";
    const nextFiles2 = inputMappings.files2 || "";
    const nextFiles3 = inputMappings.files3 || "";
    if (form.getValues("inputMappings.files") !== nextFiles) {
      form.setValue("inputMappings.files", nextFiles, { shouldDirty: false });
    }
    if (form.getValues("inputMappings.files2") !== nextFiles2) {
      form.setValue("inputMappings.files2", nextFiles2, { shouldDirty: false });
    }
    if (form.getValues("inputMappings.files3") !== nextFiles3) {
      form.setValue("inputMappings.files3", nextFiles3, { shouldDirty: false });
    }
  }, [selectedNodeId, form, ragData.inputMappings]);

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
  const handleFileUpload = async (files: FileList | null, slot: 1 | 2 | 3 = 1) => {
    if (!files || files.length === 0 || !selectedNodeId) return;

    const ragData = selectedNode.data as RAGNodeData;
    if (!ragData.fileSearchStoreName) {
      showWarning("知识库未就绪", "正在准备知识库，请稍后再试…");
      return;
    }

    setIsUploading(true);
    const uploadedFiles: { id?: string; name: string; size?: number; type?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        updateNodeData(selectedNodeId, { uploadStatus: 'uploading' });

        const result = await uploadToFileSearchStoreViaAPI(
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
          id: result.name, // Gemini resource name (files/xxx)
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

  // 删除文件
  const handleDeleteFile = async (fileName: string, fileId: string | undefined, slot: 1 | 2 | 3 = 1) => {
    if (!selectedNodeId) return;

    // 调用 API 删除远程文件
    try {
      await fetch("/api/rag/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: fileId || fileName })
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
    <div className="space-y-4 px-1 pb-4">
      {/* 1. 基础信息 - Compact */}
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
            <FormItem>
            <FormLabel className={STYLES.LABEL}>节点名称</FormLabel>
            <FormControl>
                <Input {...field} className={STYLES.INPUT} placeholder="知识库检索" />
            </FormControl>
            <FormMessage />
            </FormItem>
        )}
        />

      <div className={STYLES.SECTION_DIVIDER} />

      {/* 2. 检索语句 - 核心输入项提升 */}
      <FormField
        control={form.control}
        name="inputMappings.query"
        render={({ field }) => (
          <FormItem>
            <div className={`${STYLES.EDITOR_WRAPPER} border-blue-200 ring-blue-500/10`}>
                <div className={`${STYLES.EDITOR_HEADER} bg-blue-50/50`}>
                    <div className={`${STYLES.EDITOR_LABEL} text-blue-600`}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        检索问题
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium cursor-help hover:bg-blue-100 transition-colors border border-blue-100/50">
                              <span className="font-mono text-[10px] opacity-70">{"{{ }}"}</span>
                              <span>引用变量</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs max-w-[220px] p-3 shadow-lg">
                            <p className="font-semibold mb-1">如何引用上游变量？</p>
                            <p className="text-gray-500 leading-relaxed">
                              输入 <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{"{{节点名.变量}}"}</span> 即可引用上游节点的输出内容。
                            </p>
                          </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <FormControl>
                    <textarea
                      {...field}
                      value={draftQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftQuery(val);
                        if (queryDebounceTimerRef.current) {
                          clearTimeout(queryDebounceTimerRef.current);
                        }
                        queryDebounceTimerRef.current = setTimeout(() => {
                          flushQueryToForm(val, true);
                        }, 400);
                      }}
                      onBlur={() => {
                        field.onBlur();
                        flushQueryToForm(draftQuery, true);
                      }}
                      placeholder="写下你要从文档里找的内容，支持 {{变量}} 引用…"
                      className={STYLES.EDITOR_AREA + " min-h-[80px] text-xs py-2"}
                      spellCheck={false}
                    />
                </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 3. 核心功能：知识库管理 */}
      <div className="space-y-2">
        <div className={STYLES.SECTION_TITLE}>知识库来源</div>
        
        <div className={`${STYLES.CARD} p-0 overflow-hidden divide-y divide-gray-100`}>
          {/* Item 1: Knowledge Base Files */}
          <CapabilityItem
            icon={<Database className="w-4 h-4" />}
            iconColorClass="bg-blue-50 text-blue-600"
            title="参考文档"
            description={hasStore ? "上传或引用要检索的文档" : "正在准备知识库…"}
            isExpanded={true} // Always expanded as it's the core function
            rightElement={
                <div className="flex items-center gap-2">
                    {statusIcon}
                </div>
            }
          >
             <div className="pt-4 pb-2 px-1 space-y-6">
                {/* Mode Switching - Tab Style */}
                {(() => {
                  const hasVariableInput = !!ragData.inputMappings?.files || !!ragData.inputMappings?.files2 || !!ragData.inputMappings?.files3;
                  const effectiveFileMode = ragData.fileMode || (hasVariableInput ? 'variable' : 'static');

                  return (
                    <>
                      <div className="flex p-1 bg-gray-100/50 rounded-xl gap-1 border border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedNodeId) {
                              updateNodeData(selectedNodeId, { fileMode: 'variable' });
                            }
                          }}
                          className={`flex-1 py-1.5 px-3 text-xs rounded-lg transition-all flex items-center justify-center gap-2 ${effectiveFileMode === 'variable'
                            ? STYLES.TAB_ACTIVE
                            : STYLES.TAB_INACTIVE
                            }`}
                        >
                          <Braces className="w-3.5 h-3.5" />
                          <span>引用变量</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedNodeId) {
                              updateNodeData(selectedNodeId, { fileMode: 'static' });
                            }
                          }}
                          className={`flex-1 py-1.5 px-3 text-xs rounded-lg transition-all flex items-center justify-center gap-2 ${effectiveFileMode === 'static'
                            ? STYLES.TAB_ACTIVE
                            : STYLES.TAB_INACTIVE
                            }`}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>上传文件</span>
                        </button>
                      </div>

                      {/* Content Area */}
                      {effectiveFileMode === 'variable' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                           {/* Variable Inputs */}
                           <div className="space-y-3">
                                {/* Slot 1 */}
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                        <Variable className="w-4 h-4" />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="inputMappings.files"
                                        render={({ field }) => (
                                            <>
                                                <input
                                                    {...field}
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        field.onChange(value);
                                                    }}
                                                    placeholder="{{节点名.files}}"
                                                    className={STYLES.VARIABLE_INPUT + " pl-9"}
                                                />
                                                {field.value && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            form.setValue("inputMappings.files", "", { shouldDirty: true });
                                                        }}
                                                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${STYLES.REMOVE_BUTTON}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    />
                                </div>

                                {/* Slot 2 */}
                                {(watchedFiles2 || ragData.inputMappings?.files2 || showExtraFiles >= 1) && (
                                    <div className="relative group animate-in slide-in-from-top-2 fade-in">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <Variable className="w-4 h-4" />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="inputMappings.files2"
                                            render={({ field }) => (
                                                <>
                                                    <input
                                                        {...field}
                                                        value={field.value || ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="{{节点.files}}"
                                                        className={STYLES.VARIABLE_INPUT + " pl-9"}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            form.setValue("inputMappings.files2", "");
                                                            setShowExtraFiles(prev => Math.max(0, prev - 1));
                                                        }}
                                                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${STYLES.REMOVE_BUTTON}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        />
                                    </div>
                                )}

                                {/* Slot 3 */}
                                {(watchedFiles3 || ragData.inputMappings?.files3 || showExtraFiles >= 2) && (
                                    <div className="relative group animate-in slide-in-from-top-2 fade-in">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <Variable className="w-4 h-4" />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="inputMappings.files3"
                                            render={({ field }) => (
                                                <>
                                                    <input
                                                        {...field}
                                                        value={field.value || ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="{{节点.files}}"
                                                        className={STYLES.VARIABLE_INPUT + " pl-9"}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            form.setValue("inputMappings.files3", "");
                                                            setShowExtraFiles(prev => Math.max(0, prev - 1));
                                                        }}
                                                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${STYLES.REMOVE_BUTTON}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        />
                                    </div>
                                )}

                                {/* Add Button */}
                                {(() => {
                                    const hasFile2 = Boolean(watchedFiles2 || ragData.inputMappings?.files2 || showExtraFiles >= 1);
                                    const hasFile3 = Boolean(watchedFiles3 || ragData.inputMappings?.files3 || showExtraFiles >= 2);
                                    const canAddMore = !hasFile2 || (!hasFile3 && hasFile2);

                                    return canAddMore ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowExtraFiles(prev => Math.min(2, prev + 1))}
                                            className={STYLES.ADD_BUTTON}
                                        >
                                            <span>+</span>
                                            添加变量引用
                                        </button>
                                    ) : null;
                                })()}
                           </div>
                        </div>
                      ) : hasStore ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-300">
                             {/* Slot 1 */}
                             <div className="space-y-3">
                                {ragData.files && ragData.files.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[11px] font-semibold text-gray-900 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                主知识库 <span className="text-gray-400 font-normal">({ragData.files.length} 个文件)</span>
                                            </span>
                                        </div>
                                        <div className="grid gap-2">
                                            {ragData.files.map((file) => (
                                                <div key={file.name} className={STYLES.FILE_ITEM}>
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="truncate text-xs font-medium text-gray-700">{file.name}</span>
                                                            <span className="text-[10px] text-gray-400 uppercase">{file.name.split('.').pop() || 'FILE'}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFile(file.name, file.id, 1)}
                                                        className={STYLES.REMOVE_BUTTON}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={STYLES.FILE_AREA}>
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf,.txt,.md,.doc,.docx,.csv,.tsv,.xml,.html,.css,.json,.yaml,.yml,.js,.ts,.py,.c,.cpp,.h,.java,.go,.rs,.sh,.log,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif"
                                            className="hidden"
                                            id="rag-file-input-1"
                                            onChange={(e) => handleFileUpload(e.target.files, 1)}
                                            disabled={isUploading}
                                        />
                                        <label htmlFor="rag-file-input-1" className="cursor-pointer block space-y-3 relative z-10">
                                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-indigo-100 text-indigo-500 mx-auto flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                                                <CloudUpload className="w-5 h-5" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-gray-700 font-semibold">
                                                    {isUploading ? `上传中… ${uploadProgress}%` : '点击或拖拽上传'}
                                                </div>
                                                <div className="text-[10px] text-gray-400">
                                                    支持 PDF、Word、Markdown、TXT 等
                                                </div>
                                            </div>
                                        </label>
                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-white/60 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    </div>
                                )}
                             </div>

                             {/* Slot 2 */}
                             {((ragData.files2 && ragData.files2.length > 0) || showExtraStaticSlots >= 1) && (
                                <div className="space-y-3 pt-4 border-t border-gray-100/50">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[11px] font-semibold text-gray-900 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                            补充知识库 2
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedNodeId) updateNodeData(selectedNodeId, { files2: [] });
                                                setShowExtraStaticSlots(prev => Math.max(0, prev - 1));
                                            }}
                                            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            删除槽位
                                        </button>
                                    </div>
                                    
                                    {!(ragData.files2 && ragData.files2.length > 0) && (
                                        <div className={`${STYLES.FILE_AREA} py-4`}>
                                            <input
                                                type="file"
                                                multiple
                                                className="hidden"
                                                id="rag-file-input-2"
                                                onChange={(e) => handleFileUpload(e.target.files, 2)}
                                                disabled={isUploading}
                                            />
                                            <label htmlFor="rag-file-input-2" className="cursor-pointer block">
                                                <div className="text-xs text-gray-500 hover:text-indigo-600 transition-colors">点击上传补充文档</div>
                                            </label>
                                        </div>
                                    )}

                                    {ragData.files2 && ragData.files2.length > 0 && (
                                        <div className="grid gap-2">
                                            {ragData.files2.map((file) => (
                                                <div key={file.name} className={STYLES.FILE_ITEM}>
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="truncate text-xs font-medium text-gray-700">{file.name}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFile(file.name, file.id, 2)}
                                                        className={STYLES.REMOVE_BUTTON}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                             )}

                             {/* Slot 3 */}
                             {((ragData.files3 && ragData.files3.length > 0) || showExtraStaticSlots >= 2) && (
                                <div className="space-y-3 pt-4 border-t border-gray-100/50">
                                     <div className="flex items-center justify-between px-1">
                                        <span className="text-[11px] font-semibold text-gray-900 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                            补充知识库 3
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedNodeId) updateNodeData(selectedNodeId, { files3: [] });
                                                setShowExtraStaticSlots(prev => Math.max(0, prev - 1));
                                            }}
                                            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            删除槽位
                                        </button>
                                    </div>

                                    {!(ragData.files3 && ragData.files3.length > 0) && (
                                        <div className={`${STYLES.FILE_AREA} py-4`}>
                                            <input
                                                type="file"
                                                multiple
                                                className="hidden"
                                                id="rag-file-input-3"
                                                onChange={(e) => handleFileUpload(e.target.files, 3)}
                                                disabled={isUploading}
                                            />
                                            <label htmlFor="rag-file-input-3" className="cursor-pointer block">
                                                <div className="text-xs text-gray-500 hover:text-indigo-600 transition-colors">点击上传补充文件</div>
                                            </label>
                                        </div>
                                    )}
                                    
                                    {ragData.files3 && ragData.files3.length > 0 && (
                                        <div className="grid gap-2">
                                            {ragData.files3.map((file) => (
                                                <div key={file.name} className={STYLES.FILE_ITEM}>
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="truncate text-xs font-medium text-gray-700">{file.name}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFile(file.name, file.id, 3)}
                                                        className={STYLES.REMOVE_BUTTON}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                             )}

                             {/* Add More Button */}
                             {(() => {
                                const hasSlot2 = (ragData.files2 && ragData.files2.length > 0) || showExtraStaticSlots >= 1;
                                const hasSlot3 = (ragData.files3 && ragData.files3.length > 0) || showExtraStaticSlots >= 2;
                                const canAddMore = !hasSlot2 || (!hasSlot3 && hasSlot2);

                                return canAddMore ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowExtraStaticSlots(prev => Math.min(2, prev + 1))}
                                        className={STYLES.ADD_BUTTON}
                                    >
                                        <span>+</span>
                                        添加知识库槽位
                                    </button>
                                ) : null;
                            })()}

                            {/* Error Message */}
                            {ragData.uploadError && (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2 animate-in slide-in-from-top-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>{ragData.uploadError}</span>
                                </div>
                            )}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
             </div>
          </CapabilityItem>

          {/* Item 2: Advanced Settings (Chunking) */}
          {hasStore && (
              <CapabilityItem
                icon={<Settings2 className="w-4 h-4" />}
                iconColorClass="bg-purple-50 text-purple-600"
                title="分块策略"
                description="调整文本切分大小与重叠度"
                isExpanded={showAdvanced}
                rightElement={
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="p-1 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"
                    >
                        {showAdvanced ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </button>
                }
              >
                <div className="pt-2 pb-1 pr-4 space-y-6">
                     <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className={STYLES.SLIDER_LABEL}>分块大小</span>
                            <span className={STYLES.SLIDER_VALUE}>{ragData.maxTokensPerChunk || 200}</span>
                        </div>
                        <Slider
                            value={[ragData.maxTokensPerChunk || 200]}
                            onValueChange={([value]) => selectedNodeId && updateNodeData(selectedNodeId, { maxTokensPerChunk: value })}
                            min={50}
                            max={500}
                            step={10}
                            className="py-1"
                        />
                        <div className={STYLES.SLIDER_RANGE}>
                            <span>细粒度 (50)</span>
                            <span>粗粒度 (500)</span>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className={STYLES.SLIDER_LABEL}>重叠大小</span>
                            <span className={STYLES.SLIDER_VALUE}>{ragData.maxOverlapTokens || 20}</span>
                        </div>
                        <Slider
                            value={[ragData.maxOverlapTokens || 20]}
                            onValueChange={([value]) => selectedNodeId && updateNodeData(selectedNodeId, { maxOverlapTokens: value })}
                            min={0}
                            max={100}
                            step={5}
                            className="py-1"
                        />
                        <div className={STYLES.SLIDER_RANGE}>
                            <span>无重叠 (0)</span>
                            <span>高冗余 (100)</span>
                        </div>
                     </div>
                </div>
              </CapabilityItem>
          )}
        </div>
      </div>
    </div>
  );
}
