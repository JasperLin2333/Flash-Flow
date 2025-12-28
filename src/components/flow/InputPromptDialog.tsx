"use client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFlowStore } from "@/store/flowStore";
import type { AppNode, InputNodeData, FlowState, SelectFieldConfig, MultiSelectFieldConfig, FileInputConfig } from "@/types/flow";
import { AlertCircle, Paperclip, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { fileUploadService } from "@/services/fileUploadService";
import { showError, showWarning } from "@/utils/errorNotify";

// Type for file items - can be raw File objects or already uploaded file metadata
type UploadedFileData = { name: string; size: number; type: string; url?: string };
type InputFileItem = File | UploadedFileData;

// Helper: Check if a file item is a raw File object (not yet uploaded)
const isRawFile = (item: InputFileItem): item is File => item instanceof File;

// Helper: Get file extension from filename
const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
};

// Helper: Validate file type against allowed types
const validateFileType = (file: File, allowedTypes: string[]): boolean => {
    // Check for wildcard
    if (allowedTypes.some(t => t === '*/*' || t === '*')) return true;

    const ext = getFileExtension(file.name);
    // Flatten comma-separated values and check extensions
    const allowedExts = allowedTypes.flatMap(t =>
        t.split(',').map(s => s.trim().toLowerCase())
    );

    return allowedExts.some(allowed => {
        // Direct extension match (e.g., '.pdf', '.png')
        if (allowed.startsWith('.')) {
            return ext === allowed;
        }
        // Extension without dot (e.g., 'pdf', 'png')
        return ext === '.' + allowed || ext === allowed;
    });
};

export default function InputPromptDialog() {
    const open = useFlowStore((s: FlowState) => s.inputPromptOpen);
    const close = useFlowStore((s: FlowState) => s.closeInputPrompt);
    const confirmRun = useFlowStore((s: FlowState) => s.confirmInputRun);
    const nodes = useFlowStore((s: FlowState) => s.nodes);
    const updateNodeData = useFlowStore((s: FlowState) => s.updateNodeData);
    const currentFlowId = useFlowStore((s: FlowState) => s.currentFlowId);
    const targetNodeId = useFlowStore((s: FlowState) => s.inputPromptTargetNodeId);
    const runNode = useFlowStore((s: FlowState) => s.runNode);

    const [isUploading, setIsUploading] = useState(false);

    // 根据 targetNodeId 过滤要显示的 Input 节点
    // targetNodeId 为 null 时显示所有 Input 节点（运行全流程）
    // targetNodeId 有值时只显示指定节点（测试单个节点）
    const inputNodes = nodes.filter((n: AppNode) =>
        n.type === 'input' && (!targetNodeId || n.id === targetNodeId)
    );

    // 是否为单节点测试模式
    const isSingleNodeMode = !!targetNodeId;

    const handleConfirm = async () => {
        // 1. Validation
        for (const node of inputNodes) {
            const data = node.data as InputNodeData;
            const enableText = data.enableTextInput !== false;
            const enableForm = data.enableStructuredForm === true;

            // Text field is now optional - no validation needed

            // Validate Form
            if (enableForm && data.formFields) {
                for (const field of data.formFields) {
                    if (field.required) {
                        const val = data.formData?.[field.name];
                        const isEmpty = Array.isArray(val) ? val.length === 0 : (!val && val !== 0);
                        if (isEmpty) {
                            showWarning("必填字段未填", `请为节点 "${data.label || 'Input'}" 填写: ${field.label}`);
                            return;
                        }
                    }
                }
            }
        }

        // 2. Upload and Run
        setIsUploading(true);
        try {
            for (const node of inputNodes) {
                const data = node.data as InputNodeData;
                const enableFile = data.enableFileInput === true;

                if (enableFile && data.files && data.files.length > 0) {
                    const processedFiles: UploadedFileData[] = [];
                    // Check if there are any raw File objects needing upload
                    const fileItems = data.files as InputFileItem[];
                    const filesToUpload = fileItems.filter(isRawFile);

                    if (filesToUpload.length > 0) {
                        // Only upload if we have a flow ID (should handle "Run" in builder where flow might usually save first?)
                        // Usually confirmInputRun implies we are running an existing flow context?
                        // If flow does not exist yet (unsaved), uploads might fail or go to temp?
                        // Assuming currentFlowId exists.
                        const flowId = currentFlowId || "temp";

                        for (const fileItem of fileItems) {
                            if (isRawFile(fileItem)) {
                                const result = await fileUploadService.uploadFile(fileItem, node.id, flowId);
                                if (result) {
                                    processedFiles.push({
                                        name: fileItem.name,
                                        size: fileItem.size,
                                        type: fileItem.type,
                                        url: result.url
                                    });
                                } else {
                                    throw new Error(`Uploading file ${fileItem.name} failed.`);
                                }
                            } else {
                                processedFiles.push(fileItem);
                            }
                        }

                        // Update with processed (uploaded) files
                        updateNodeData(node.id, { files: processedFiles });
                    }
                }
            }

            // 根据模式选择执行方式
            if (isSingleNodeMode && targetNodeId) {
                // 单节点测试模式：只运行指定节点
                const targetNode = inputNodes[0];
                if (targetNode) {
                    const data = targetNode.data as InputNodeData;
                    close();  // 先关闭弹窗
                    await runNode(targetNodeId, {
                        user_input: data.text || '',
                        formData: data.formData || {},
                    });
                }
            } else {
                // 全流程模式：运行整个 flow
                await confirmRun();
            }
        } catch (e: any) {
            console.error(e);
            showError("运行失败", e.message || "未知错误");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (
        nodeId: string,
        currentFiles: InputFileItem[],
        fileConfig: FileInputConfig | undefined,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const newFiles = Array.from(e.target.files || []);
        if (newFiles.length === 0) return;

        const maxCount = fileConfig?.maxCount || 10;
        const maxSizeMB = fileConfig?.maxSizeMB || 50;
        const allowedTypes = fileConfig?.allowedTypes || ["*/*"];

        // 1. Check Count
        if (currentFiles.length + newFiles.length > maxCount) {
            showWarning("文件数量超限", `最多只能上传 ${maxCount} 个文件，当前已选择 ${currentFiles.length} 个`);
            return;
        }

        // 2. Check Size
        const oversized = newFiles.filter(f => f.size > maxSizeMB * 1024 * 1024);
        if (oversized.length > 0) {
            showWarning("文件过大", `文件 "${oversized[0].name}" 超过最大体积 ${maxSizeMB}MB`);
            return;
        }

        // 3. Check Type using improved validation
        const invalidFiles = newFiles.filter(f => !validateFileType(f, allowedTypes));
        if (invalidFiles.length > 0) {
            showWarning("文件类型不支持", `不支持的文件类型: ${invalidFiles[0].name}`);
            return;
        }

        // Store File objects directly (will be uploaded on confirm)
        updateNodeData(nodeId, {
            files: [...currentFiles, ...newFiles]
        });

        // Reset input
        e.target.value = "";
    };

    const removeFile = (nodeId: string, currentFiles: InputFileItem[], index: number) => {
        const newFiles = [...currentFiles];
        newFiles.splice(index, 1);
        updateNodeData(nodeId, { files: newFiles });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && !isUploading && close()}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-bold text-base">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        填写输入数据
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        请为以下输入节点填写数据后再运行流程
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {inputNodes.map((node: AppNode) => {
                        const data = node.data as InputNodeData;
                        const enableText = data.enableTextInput !== false;
                        const enableFile = data.enableFileInput === true;
                        const enableForm = data.enableStructuredForm === true;

                        const files = (data.files || []) as InputFileItem[];
                        const formData = data.formData || {};
                        const fileConfig = data.fileConfig || { allowedTypes: ["*/*"], maxSizeMB: 50, maxCount: 10 };

                        return (
                            <div key={node.id} className="space-y-3 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        {data.label || 'Input'}
                                    </label>
                                </div>

                                {/* Text Input */}
                                {enableText && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-medium text-gray-500">
                                                文本内容
                                            </span>
                                        </div>
                                        <Textarea
                                            placeholder="请输入文本数据..."
                                            value={data.text || ''}
                                            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                                            className="min-h-[80px] text-sm placeholder:text-sm placeholder:text-gray-400 resize-none focus-visible:ring-1"
                                            disabled={isUploading}
                                        />
                                    </div>
                                )}

                                {/* File Input */}
                                {enableFile && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-gray-500">
                                                附件上传 (Max: {fileConfig.maxCount})
                                            </span>
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    id={`file-upload-${node.id}`}
                                                    onChange={(e) => handleFileSelect(node.id, files, fileConfig, e)}
                                                    accept={fileConfig.allowedTypes?.join(',')}
                                                    disabled={isUploading}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => document.getElementById(`file-upload-${node.id}`)?.click()}
                                                    disabled={isUploading}
                                                >
                                                    <Paperclip className="w-3 h-3" />
                                                    上传文件
                                                </Button>
                                            </div>
                                        </div>

                                        {/* File List */}
                                        {files.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {files.map((file, i) => (
                                                    <div key={i} className="flex items-center gap-2 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs">
                                                        <span className="max-w-[120px] truncate" title={file.name}>{file.name}</span>
                                                        <span className="text-gray-400 text-[10px]">{(file.size / 1024).toFixed(0)}KB</span>
                                                        <button
                                                            onClick={() => removeFile(node.id, files, i)}
                                                            className="text-gray-400 hover:text-red-500"
                                                            disabled={isUploading}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Structured Form */}
                                {enableForm && (
                                    <div className="space-y-3 pt-2 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs font-medium text-gray-500 mb-2">表单数据</div>
                                        {(!data.formFields || data.formFields.length === 0) ? (
                                            <div className="text-xs text-gray-400 italic">
                                                暂无表单字段配置
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {data.formFields.map((field) => (
                                                    <div key={field.name} className="space-y-1.5">
                                                        <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                                            {field.label}
                                                            {field.required && <span className="text-red-500">*</span>}
                                                        </label>

                                                        {field.type === 'select' ? (
                                                            <Select
                                                                value={(formData[field.name] as string) || ""}
                                                                onValueChange={(val) => {
                                                                    updateNodeData(node.id, {
                                                                        formData: { ...formData, [field.name]: val }
                                                                    });
                                                                }}
                                                                disabled={isUploading}
                                                            >
                                                                <SelectTrigger className="h-8 text-sm bg-white">
                                                                    <SelectValue placeholder="请选择" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(field as SelectFieldConfig).options.map(opt => (
                                                                        <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : field.type === 'multi-select' ? (
                                                            <div className="border border-gray-200 rounded p-2 bg-white max-h-32 overflow-y-auto space-y-1">
                                                                {(field as MultiSelectFieldConfig).options.map(opt => {
                                                                    const vals = (formData[field.name] as string[]) || [];
                                                                    const checked = vals.includes(opt);
                                                                    return (
                                                                        <div key={opt} className="flex items-center gap-2">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={(e) => {
                                                                                    const newVals = e.target.checked
                                                                                        ? [...vals, opt]
                                                                                        : vals.filter(v => v !== opt);
                                                                                    updateNodeData(node.id, {
                                                                                        formData: { ...formData, [field.name]: newVals }
                                                                                    });
                                                                                }}
                                                                                className="rounded border-gray-300 w-3.5 h-3.5"
                                                                                disabled={isUploading}
                                                                            />
                                                                            <span className="text-xs">{opt}</span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <Input
                                                                className="h-8 text-sm bg-white placeholder:text-sm placeholder:text-gray-400"
                                                                placeholder={field.type === 'text' ? (field.placeholder || "请输入") : "请输入"}
                                                                value={(formData[field.name] as string) || ""}
                                                                onChange={(e) => {
                                                                    updateNodeData(node.id, {
                                                                        formData: { ...formData, [field.name]: e.target.value }
                                                                    });
                                                                }}
                                                                disabled={isUploading}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={close} disabled={isUploading} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isUploading}
                        className="bg-black text-white hover:bg-black/85 active:bg-black/95 font-semibold transition-colors duration-150 min-w-[80px]"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认运行"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
