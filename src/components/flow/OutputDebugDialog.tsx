"use client";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import type { OutputNodeData, AppNode, FlowState, ContentSource } from "@/types/flow";
import { getOutputModeLabel } from "@/lib/outputModeConstants";
import { Loader2, Paperclip, X, Play } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { showWarning } from "@/utils/errorNotify";
import { getFileExtension } from "@/utils/fileUtils";

// Output 节点附件的限制配置
const OUTPUT_MAX_FILE_COUNT = 20;
const OUTPUT_MAX_SIZE_MB = 100;

type FileItem = { name: string; url: string; size?: number; type?: string };

export default function OutputDebugDialog() {
    // Use unified dialog API
    const open = useFlowStore((s: FlowState) => s.activeDialog === 'output');
    const nodeId = useFlowStore((s: FlowState) => s.activeNodeId);
    const nodes = useFlowStore((s: FlowState) => s.nodes);
    const closeDialog = useFlowStore((s: FlowState) => s.closeDialog);
    const setDialogData = useFlowStore((s: FlowState) => s.setDialogData);
    const confirmDialogRun = useFlowStore((s: FlowState) => s.confirmDialogRun);
    const updateNodeData = useFlowStore((s: FlowState) => s.updateNodeData);

    const [contentValues, setContentValues] = useState<string[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);

    // Use shared file upload hook
    const currentFlowId = useFlowStore((s: FlowState) => s.currentFlowId);
    const { isUploading, uploadFiles } = useFileUpload(nodeId, currentFlowId || "temp", {
        maxSizeMB: OUTPUT_MAX_SIZE_MB,
        maxCount: OUTPUT_MAX_FILE_COUNT,
    });

    // 获取当前节点和配置
    const currentNode = nodes.find((n: AppNode) => n.id === nodeId);
    const nodeData = currentNode?.data as OutputNodeData | undefined;
    const inputMappings = nodeData?.inputMappings;

    // Load existing data when dialog opens
    useEffect(() => {
        if (!open || !nodeData) {
            setContentValues([]);
            setFiles([]);
            return;
        }

        // Load content sources
        const mode = inputMappings?.mode || 'direct';
        if (mode === 'template') {
            setContentValues([inputMappings?.template || '']);
        } else {
            const sources = inputMappings?.sources || [];
            if (sources.length > 0) {
                setContentValues(sources.map(s => s.value || ''));
            } else {
                setContentValues(['']); // Default one empty input
            }
        }

        // Load existing attachments (as static files)
        const existingAttachments = inputMappings?.attachments || [];
        const staticFiles: FileItem[] = existingAttachments
            .filter(a => a.type === 'static' && a.value)
            .map(a => ({ name: a.value.split('/').pop() || 'file', url: a.value }));
        setFiles(staticFiles);

    }, [open, nodeId, nodeData, inputMappings]);

    const handleContentChange = (index: number, value: string) => {
        const newValues = [...contentValues];
        newValues[index] = value;
        setContentValues(newValues);
    };

    // File Upload Logic (using shared hook)
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0 || !nodeId) return;

        const result = await uploadFiles(selectedFiles, files.length);

        // Show errors if any
        if (result.errors.length > 0) {
            result.errors.forEach(err => showWarning("上传问题", err));
        }

        // Add successfully uploaded files
        if (result.files.length > 0) {
            const updatedFiles: FileItem[] = [
                ...files,
                ...result.files.map(f => ({ name: f.name, url: f.url, size: f.size, type: f.type }))
            ];
            setFiles(updatedFiles);

            // Persist to node data immediately
            const newAttachments = updatedFiles.map(f => ({ type: 'static' as const, value: f.url }));
            const currentMode = inputMappings?.mode || 'direct';
            const updates: Partial<OutputNodeData> = {
                inputMappings: {
                    mode: currentMode,
                    ...inputMappings,
                    attachments: newAttachments
                }
            };
            updateNodeData(nodeId, updates);
        }

        e.target.value = "";
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);

        // Persist to node data
        if (nodeId) {
            const newAttachments = newFiles.map(f => ({ type: 'static' as const, value: f.url }));
            const currentMode = inputMappings?.mode || 'direct';
            const updates: Partial<OutputNodeData> = {
                inputMappings: {
                    mode: currentMode,
                    ...inputMappings,
                    attachments: newAttachments
                }
            };
            updateNodeData(nodeId, updates);
        }
    };

    const handleConfirm = () => {
        if (!nodeId) return;

        // Save content values to node
        const mode = inputMappings?.mode || 'direct';
        const existingSources = inputMappings?.sources || [];

        if (mode === 'template') {
            // 模板模式：直接更新模板内容
            const updates: Partial<OutputNodeData> = {
                inputMappings: { ...inputMappings, mode, template: contentValues[0] || '' }
            };
            updateNodeData(nodeId, updates);
        } else {
            // sources 模式：保留原有的 source 类型（variable/static），仅更新 value
            const newSources: ContentSource[] = contentValues.map((val, i) => {
                const existingSource = existingSources[i];
                return {
                    // 保留原有类型，如果是新增的则默认为 static（因为是手动输入的值）
                    type: existingSource?.type || 'static',
                    value: val,
                    label: existingSource?.label
                };
            });
            const updates: Partial<OutputNodeData> = {
                inputMappings: { ...inputMappings, mode, sources: newSources }
            };
            updateNodeData(nodeId, updates);
        }

        setDialogData({ mockVariables: {} });
        confirmDialogRun();
    };



    const isValid = contentValues.length > 0 && contentValues.every(v => v.trim());

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val && !isUploading) closeDialog(); }}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 shrink-0 bg-white">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        测试节点
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 settings-scrollbar">
                    {/* Content Input Section */}
                    <div className="space-y-4">
                        {contentValues.map((val, idx) => (
                            <div key={idx} className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700 block">
                                    {contentValues.length === 1 ? '输出内容' : `内容 #${idx + 1}`}
                                    <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                                </Label>
                                <Textarea
                                    placeholder="请输入内容..."
                                    value={val}
                                    onChange={(e) => handleContentChange(idx, e.target.value)}
                                    className="min-h-[120px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3"
                                    disabled={isUploading}
                                />
                            </div>
                        ))}
                    </div>

                    {/* File Upload Section (Matching RAG) */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium text-gray-700">
                                附件
                                <span className="text-gray-400 ml-2 text-xs font-normal">(可选)</span>
                            </Label>
                            <div className="relative">
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    id={`output-file-upload-${nodeId}`}
                                    onChange={handleFileSelect}
                                    disabled={isUploading}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                                    onClick={() => document.getElementById(`output-file-upload-${nodeId}`)?.click()}
                                    disabled={isUploading}
                                >
                                    <Paperclip className="w-3.5 h-3.5" />
                                    添加文件
                                </Button>
                            </div>
                        </div>

                        {/* File List */}
                        {files.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                                {files.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg group hover:border-gray-200 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">
                                                    {getFileExtension(file.name).replace('.', '') || 'FILE'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm text-gray-700 font-medium truncate" title={file.name}>{file.name}</span>
                                                {file.size && <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)}KB</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFile(i)}
                                            className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                            disabled={isUploading}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs">
                                暂无文件，请添加
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                    <Button variant="ghost" onClick={closeDialog} disabled={isUploading} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isUploading || !isValid}
                        className="bg-black text-white hover:bg-black/90 px-6 rounded-lg font-medium shadow-sm transition-all"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> 运行</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
