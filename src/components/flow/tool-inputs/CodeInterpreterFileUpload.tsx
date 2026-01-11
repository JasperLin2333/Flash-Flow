"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Paperclip, X } from "lucide-react";
import { useFlowStore } from "@/store/flowStore";
import { useFileUpload } from "@/hooks/useFileUpload";
import { showWarning } from "@/utils/errorNotify";
import { getFileExtension } from "@/utils/fileUtils";
import { MAX_FILE_SIZE, SUPPORTED_FILE_EXTENSIONS, MAX_FILE_COUNT } from "@/services/geminiFileSearchAPI";
import { formatFieldLabel } from "@/lib/tools/toolFieldNames";

// File item type for code interpreter
export interface CodeFileItem {
    name: string;
    url: string;
    size?: number;
    type?: string;
}



interface CodeInterpreterFileUploadProps {
    nodeId: string;
    files: CodeFileItem[];
    onFilesChange: (files: CodeFileItem[]) => void;
    isOptional: boolean;
    disabled?: boolean;
}

/**
 * Code Interpreter 文件上传组件
 * 从 ToolDebugDialog 抽取，支持多文件上传到 Supabase Storage
 */
export function CodeInterpreterFileUpload({
    nodeId,
    files,
    onFilesChange,
    isOptional,
    disabled = false,
}: CodeInterpreterFileUploadProps) {
    const currentFlowId = useFlowStore((s) => s.currentFlowId);

    // Use shared hook with extension-based validation
    const { isUploading, uploadFiles } = useFileUpload(nodeId, currentFlowId || "temp", {
        maxSizeMB: MAX_FILE_SIZE / (1024 * 1024),
        maxCount: MAX_FILE_COUNT,
        allowedExtensions: SUPPORTED_FILE_EXTENSIONS,
    });

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
            const updatedFiles: CodeFileItem[] = [
                ...files,
                ...result.files.map(f => ({ name: f.name, url: f.url, size: f.size, type: f.type }))
            ];
            onFilesChange(updatedFiles);
        }

        e.target.value = "";
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        onFilesChange(newFiles);
    };

    const isDisabled = disabled || isUploading;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    {formatFieldLabel("inputFiles")}
                    {!isOptional && <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>}
                    {isOptional && <span className="text-gray-400 ml-2 text-xs font-normal">(可选)</span>}
                </Label>
                <div className="relative">
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        id={`tool-file-upload-${nodeId}`}
                        onChange={handleFileSelect}
                        disabled={isDisabled}
                        accept={SUPPORTED_FILE_EXTENSIONS.join(',')}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 bg-white"
                        onClick={() => document.getElementById(`tool-file-upload-${nodeId}`)?.click()}
                        disabled={isDisabled}
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                        {isUploading ? "上传中..." : "添加文件"}
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
                                disabled={isDisabled}
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
    );
}
