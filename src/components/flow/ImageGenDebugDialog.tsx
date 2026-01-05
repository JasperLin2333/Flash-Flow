"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import { Loader2, Paperclip, X, Play } from "lucide-react";
import { fileUploadService } from "@/services/fileUploadService";
import { showError, showWarning } from "@/utils/errorNotify";
import { useImageGenModel } from "@/hooks/useImageGenModel";
import type { ImageGenNodeData } from "@/types/flow";

// Reuse file typing structure for local display
type ImageGenFileItem = { id?: string; name: string; size?: number; type?: string; url?: string };
const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
};

import { useFileUpload } from "@/hooks/useFileUpload";

// Validation Constants (Legacy constants removed, using Hook config)
const SUPPORTED_FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

export default function ImageGenDebugDialog() {
    // Use unified dialog API
    const open = useFlowStore((s) => s.activeDialog === 'imagegen');
    const nodeId = useFlowStore((s) => s.activeNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    const closeDialog = useFlowStore((s) => s.closeDialog);
    const dialogData = useFlowStore((s) => s.dialogData) as { prompt?: string; negativePrompt?: string };
    const setDialogData = useFlowStore((s) => s.setDialogData);
    const confirmDialogRun = useFlowStore((s) => s.confirmDialogRun);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);

    const [files, setFiles] = useState<ImageGenFileItem[]>([]);

    // Use useFileUpload hook
    const { uploadFiles, isUploading } = useFileUpload(nodeId, useFlowStore.getState().currentFlowId || "temp", {
        maxCount: 3,
        maxSizeMB: 10,
        allowedExtensions: SUPPORTED_FILE_EXTENSIONS
    });

    const currentNode = nodes.find(n => n.id === nodeId);
    const nodeData = currentNode?.data as ImageGenNodeData | undefined;
    const nodeName = nodeData?.label || 'ImageGen';

    const selectedModelId = nodeData?.model || "Kwai-Kolors/Kolors";

    // Use hook for model capabilities (centralized logic)
    const { capabilities: modelCapabilities } = useImageGenModel(selectedModelId);

    // Load data when dialog opens
    useEffect(() => {
        if (open && nodeData) {
            // Load Files from nodeData slots
            const currentFiles: ImageGenFileItem[] = [];

            // Helper to add file if URL exists
            const addFileFromUrl = (url: string | undefined, index: number) => {
                if (url && typeof url === 'string' && url.length > 0) {
                    // Try to guess name from URL or default
                    const name = url.split('/').pop() || `image-${index + 1}.png`;
                    currentFiles.push({
                        name: name,
                        type: 'image/png', // Guess
                        url: url
                    });
                }
            };

            addFileFromUrl(nodeData.referenceImageUrl, 0);
            addFileFromUrl(nodeData.referenceImageUrl2, 1);
            addFileFromUrl(nodeData.referenceImageUrl3, 2);

            setFiles(currentFiles);

            // Sync inputs with nodeData prompt if debug input is empty
            if (!dialogData.prompt && nodeData.prompt) {
                setDialogData({
                    prompt: nodeData.prompt,
                    negativePrompt: nodeData.negativePrompt || ""
                });
            } else if (dialogData.negativePrompt === undefined && nodeData.negativePrompt) {
                // Ensure negative prompt is synced if it was missing in inputs but exists in nodeData
                setDialogData({
                    ...dialogData,
                    negativePrompt: nodeData.negativePrompt
                });
            }
        } else if (!open) {
            setFiles([]);
        }
    }, [open, nodeId, nodeData]); // Depend on nodeData to refresh if it changes

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0 || !nodeId) return;

        // Use hook for validation and upload
        const result = await uploadFiles(selectedFiles, files.length);

        if (result.errors.length > 0) {
            // Show all errors
            result.errors.forEach(err => showWarning("上传失败", err));
        }

        if (result.files.length > 0) {
            const newUploadedFiles: ImageGenFileItem[] = result.files.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type,
                url: f.url
            }));

            const updatedFiles = [...files, ...newUploadedFiles];
            setFiles(updatedFiles);
            // Sync back to Node Data Slots
            updateNodeSlots(updatedFiles);
        }

        e.target.value = "";
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);
        updateNodeSlots(newFiles);
    };

    // Map list of files back to referenceImageUrl, 2, 3
    const updateNodeSlots = (fileList: ImageGenFileItem[]) => {
        if (!nodeId) return;
        const updates: Partial<ImageGenNodeData> = {
            referenceImageUrl: "",
            referenceImageUrl2: "",
            referenceImageUrl3: ""
        };

        if (fileList[0]) updates.referenceImageUrl = fileList[0].url;
        if (fileList[1]) updates.referenceImageUrl2 = fileList[1].url;
        if (fileList[2]) updates.referenceImageUrl3 = fileList[2].url;

        updateNodeData(nodeId, updates);
    };

    const handleConfirm = async () => {
        if (!dialogData.prompt?.trim()) return;

        // Just run, uploads are already done
        await confirmDialogRun();
    };

    // Logic for validation
    const isPromptEmpty = !dialogData.prompt || !dialogData.prompt.trim();
    const isImg2Img = modelCapabilities.supportsReferenceImage;
    const isImageMissing = isImg2Img && files.length === 0;

    // UI Messages - Removed red styling logic as per request
    // We just rely on the disabled button state for enforcement

    return (
        <Dialog open={open} onOpenChange={(val) => !val && !isUploading && closeDialog()}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 shrink-0 bg-white">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        测试节点
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 settings-scrollbar">
                    {/* File Upload Section - Only if model supports reference image */}
                    {isImg2Img && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-sm font-medium text-gray-700">
                                    参考图片
                                    <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                                </Label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        id={`img-file-upload-${nodeId}`}
                                        onChange={handleFileSelect}
                                        disabled={isUploading || files.length >= 3}
                                        accept={SUPPORTED_FILE_EXTENSIONS.join(',')}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs gap-1.5 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                                        onClick={() => document.getElementById(`img-file-upload-${nodeId}`)?.click()}
                                        disabled={isUploading || files.length >= 3}
                                    >
                                        <Paperclip className="w-3.5 h-3.5" />
                                        添加图片
                                    </Button>
                                </div>
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="grid grid-cols-1 gap-2">
                                    {files.map((file, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg group hover:border-gray-200 transition-colors">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {file.url ? (
                                                        <img src={file.url} alt=" thumb" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase">IMG</span>
                                                    )}
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
                            )}
                            {files.length === 0 && (
                                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs">
                                    暂无图片，请添加
                                </div>
                            )}
                        </div>
                    )}

                    {/* Prompt Section */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700 block">
                                图片描述
                                <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                            </Label>
                            <Textarea
                                placeholder="填写用于生成的提示词..."
                                value={dialogData.prompt || ""}
                                onChange={(e) => setDialogData({ ...dialogData, prompt: e.target.value })}
                                className="min-h-[120px] text-sm resize-none border-gray-200 rounded-lg p-3 focus-visible:ring-1 focus-visible:ring-black"
                                disabled={isUploading}
                            />
                        </div>

                        {/* Negative Prompt Section - Optional */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700 block">
                                负向提示词
                                <span className="text-gray-400 ml-2 text-xs font-normal">(可选)</span>
                            </Label>
                            <Textarea
                                placeholder="填写不希望出现的元素..."
                                value={dialogData.negativePrompt || ""}
                                onChange={(e) => setDialogData({ ...dialogData, negativePrompt: e.target.value })}
                                className="min-h-[80px] text-sm resize-none border-gray-200 rounded-lg p-3 focus-visible:ring-1 focus-visible:ring-black"
                                disabled={isUploading}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                    <Button variant="ghost" onClick={closeDialog} disabled={isUploading} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isUploading || isPromptEmpty || isImageMissing}
                        className="bg-black text-white hover:bg-black/90 px-6 rounded-lg font-medium shadow-sm transition-all"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> 运行</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
