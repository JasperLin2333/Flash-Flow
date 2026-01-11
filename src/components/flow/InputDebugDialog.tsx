"use client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFlowStore } from "@/store/flowStore";
import type { AppNode, InputNodeData, FlowState, SelectFieldConfig, MultiSelectFieldConfig, FileInputConfig } from "@/types/flow";
import { isInputNode } from "@/types/flow";
import { Paperclip, X, Loader2, Check, ChevronDown, Play, MousePointerClick } from "lucide-react";
import { useState, useEffect } from "react";
import { fileUploadService } from "@/services/fileUploadService";
import { showError, showWarning } from "@/utils/errorNotify";
import { getFileExtension } from "@/utils/fileUtils";
import { isFieldEmpty } from "@/store/utils/inputValidation";
import { useFileUpload } from "@/hooks/useFileUpload";

// Type for file items - can be raw File objects or already uploaded file metadata
type UploadedFileData = { name: string; size: number; type: string; url?: string };
type InputFileItem = File | UploadedFileData;

// Helper: Check if a file item is a raw File object (not yet uploaded)
const isRawFile = (item: InputFileItem): item is File => item instanceof File;

/**
 * InputDebugDialog
 * 
 * Unified debug dialog for Input Nodes.
 * Handles:
 * 1. Runtime input collection (when running flow)
 * 2. Single node debugging (Test/Run)
 */
export default function InputDebugDialog() {
    // Unified API hooks
    const activeDialog = useFlowStore((s: FlowState) => s.activeDialog);
    const activeNodeId = useFlowStore((s: FlowState) => s.activeNodeId);
    const closeDialog = useFlowStore((s: FlowState) => s.closeDialog);
    const confirmDialogRun = useFlowStore((s: FlowState) => s.confirmDialogRun);
    const runNode = useFlowStore((s: FlowState) => s.runNode);

    // Legacy store hooks needed for logic
    const nodes = useFlowStore((s: FlowState) => s.nodes);
    const updateNodeData = useFlowStore((s: FlowState) => s.updateNodeData);
    const currentFlowId = useFlowStore((s: FlowState) => s.currentFlowId);

    // Derived state
    const open = activeDialog === 'input';

    // Determine which nodes to show
    // If activeNodeId is set, we are likely debugging that specific node.
    // However, for Input nodes, the "Run Flow" action might also trigger this dialog
    // and strictly speaking, we might want to fill ALL input nodes if starting a flow.
    // BUT the Unified API generally targets one node at a time or uses a different mechanism.
    // For now, we replicate "InputPrompt" logic: if targetNodeId is null, show all inputs.
    // Wait, the Unified API usually insists on a nodeId.
    // If we want "Run Flow" to open this, we need to handle the case where activeNodeId might be null/undefined logic in the caller?
    // Actually, `confirmDialogRun` handles the resume logic.
    // Let's assume:
    // - Debug single node: activeNodeId is set.
    // - Run Flow (catch-all): maybe activeNodeId is the *first* input node? Or we just iterate all.
    // The previous logic used `targetNodeId || n.id === targetNodeId` filter.
    // If we are replacing InputPrompt, we need to support "All Inputs" mode.
    // The Unified API `openDialog` requires a `nodeId`. 
    // This implies we might need a special "Run All" entry point or just stick to single node debugging?
    // NO, the original requirement (Step 17) shows `InputPromptDialog` handling ONE OR ALL.
    // We will preserve this "All" capability if `activeNodeId` is null (if type allows) or handled via specific flag?
    // Actually, `activeNodeId` is `string | null`. 
    // If `activeNodeId` is present, show ONLY that node.
    // If `activeNodeId` is null, show ALL input nodes.
    // Use type guard for type-safe filtering
    const inputNodes = nodes.filter(
        (n): n is AppNode & { data: InputNodeData } =>
            isInputNode(n) && (!activeNodeId || n.id === activeNodeId)
    );

    const targetNode = inputNodes[0];

    // Initialize useFileUpload hook
    // We assume single input node. If targetNode is undefined, hook will just return empty/false.
    // Config: we use the config from the node data or defaults
    const rawConfig = targetNode?.data?.fileConfig;

    // Robustly determine allowedTypes
    let computedAllowedTypes = rawConfig?.allowedTypes || ["*/*"];
    if (!computedAllowedTypes || computedAllowedTypes.length === 0) {
        computedAllowedTypes = ["*/*"];
    } else {
        // If explicitly set, sanitize it. 
        // If it contains wildcard, ensure we don't accidentally fail on other types if the logic is strict
        // (Though our validator logic handles wildcard correctly if present)
        if (computedAllowedTypes.some(t => t === "*" || t === "*/*")) {
            computedAllowedTypes = ["*/*"];
        }
    }

    const { uploadFiles, validateFiles, isUploading } = useFileUpload(
        targetNode?.id || null,
        currentFlowId || "temp",
        {
            maxSizeMB: rawConfig?.maxSizeMB || 100,
            maxCount: rawConfig?.maxCount || 10,
            allowedTypes: computedAllowedTypes
        }
    );

    const handleConfirm = async () => {
        // 1. Validation
        for (const node of inputNodes) {
            const { data } = node;

            // NOTE: Text Input validation is explicitly OPTIONAL per user request.
            // const enableText = data.enableTextInput !== false;

            const enableForm = data.enableStructuredForm === true;

            // Validate Form
            if (enableForm && data.formFields) {
                for (const field of data.formFields) {
                    if (field.required) {
                        const val = data.formData?.[field.name];
                        if (isFieldEmpty(val)) {
                            showWarning("必填字段未填", `请为节点 "${data.label || 'Input'}" 填写: ${field.label}`);
                            return;
                        }
                    }
                }
            }
        }

        // 2. Upload and Run
        try {
            // We assume single input node for now as per user constraint
            const targetNode = inputNodes[0];
            if (targetNode) {
                const { data } = targetNode;
                const enableFile = data.enableFileInput === true;

                if (enableFile && data.files && data.files.length > 0) {
                    const fileItems = data.files as InputFileItem[];
                    const filesToUpload = fileItems.filter(isRawFile);

                    // If there are files to upload, we strictly use the hook's uploadFiles
                    // This allows us to use the standard validation and upload logic
                    if (filesToUpload.length > 0) {
                        const result = await uploadFiles(filesToUpload, fileItems.length - filesToUpload.length);

                        if (result.errors.length > 0) {
                            // Show first error
                            showWarning("上传失败", result.errors[0]);
                            return; // Stop execution if upload fails
                        }

                        // Merge uploaded files back into the list, replacing raw files
                        const processedFiles: UploadedFileData[] = [];
                        const uploadedMap = new Map(result.files.map(f => [f.name, f]));

                        for (const item of fileItems) {
                            if (isRawFile(item)) {
                                const uploaded = uploadedMap.get(item.name);
                                if (uploaded) {
                                    processedFiles.push(uploaded);
                                }
                            } else {
                                processedFiles.push(item);
                            }
                        }
                        updateNodeData(targetNode.id, { files: processedFiles });
                    }
                }
            }

            // Execute
            if (activeNodeId) {
                // Debug Single Node
                const targetNode = nodes.find(n => n.id === activeNodeId);
                if (targetNode && isInputNode(targetNode)) {
                    const { data } = targetNode;
                    closeDialog();
                    await runNode(activeNodeId, {
                        user_input: data.text || '',
                        formData: data.formData || {},
                    });
                }
            } else {
                // Run Full Flow (Resume)
                await confirmDialogRun();
            }
        } catch (e: any) {
            console.error(e);
            showError("运行失败", e.message || "未知错误");
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

        // Use hook's validateFiles for consistent validation
        // We pass existing count to check total count
        const validation = validateFiles(newFiles, currentFiles.length);

        if (validation.errors.length > 0) {
            // Show all errors or just the first one? unified showing first usually
            showWarning("文件校验失败", validation.errors[0]);
            e.target.value = "";
            return;
        }

        updateNodeData(nodeId, {
            files: [...currentFiles, ...validation.valid]
        });
        e.target.value = "";
    };

    const removeFile = (nodeId: string, currentFiles: InputFileItem[], index: number) => {
        const newFiles = [...currentFiles];
        newFiles.splice(index, 1);
        updateNodeData(nodeId, { files: newFiles });
    };

    // UX: Node Label handling
    const isSingle = inputNodes.length === 1;

    return (
        <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && !isUploading && closeDialog()}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100 shrink-0 bg-white">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        测试节点
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 settings-scrollbar">
                    {inputNodes.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            无 Input 节点需要填写。
                        </div>
                    )}

                    {inputNodes.map((node: AppNode) => {
                        const data = node.data as InputNodeData;
                        const enableText = data.enableTextInput !== false;
                        const enableFile = data.enableFileInput === true;
                        const enableForm = data.enableStructuredForm === true;

                        const files = (data.files || []) as InputFileItem[];
                        const formData = data.formData || {};
                        const fileConfig = data.fileConfig || { allowedTypes: ["*/*"], maxSizeMB: 100, maxCount: 10 };

                        return (
                            <div key={node.id} className="space-y-5">
                                {/* Node Header (if multiple) or just Label */}
                                {(!isSingle || activeNodeId) && (
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                        <div className="w-1.5 h-4 bg-black rounded-full" />
                                        <h3 className="text-sm font-bold text-gray-900">
                                            {data.label || 'Input Node'}
                                        </h3>
                                    </div>
                                )}

                                {/* User Greeting/Instructions */}
                                {data.greeting && (
                                    <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg border border-blue-100">
                                        {data.greeting}
                                    </div>
                                )}

                                {/* Text Input */}
                                {enableText && (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-gray-700 block">
                                            文本内容 <span className="text-gray-400 font-normal text-xs">(可选)</span>
                                        </Label>
                                        <Textarea
                                            placeholder={isSingle ? "请输入文本数据..." : `请输入 ${data.label} 的文本...`}
                                            value={data.text || ''}
                                            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                                            className="min-h-[100px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3"
                                            disabled={isUploading}
                                        />
                                    </div>
                                )}

                                {/* File Input */}
                                {enableFile && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                                附件上传
                                                <span className="text-gray-400 ml-1 text-xs font-normal">(Max: {fileConfig.maxCount})</span>
                                            </Label>
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
                                                    className="h-8 text-xs gap-1.5 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                                                    onClick={() => document.getElementById(`file-upload-${node.id}`)?.click()}
                                                    disabled={isUploading}
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                    上传
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
                                                                <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)}KB</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeFile(node.id, files, i)}
                                                            className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                            disabled={isUploading}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs">
                                                暂无文件
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Structured Form */}
                                {enableForm && (
                                    <div className="space-y-4 pt-2">
                                        {(!data.formFields || data.formFields.length === 0) ? (
                                            <div className="text-sm text-gray-400 italic py-2 text-center bg-gray-50 rounded-lg">
                                                暂无表单字段配置
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {data.formFields.map((field) => (
                                                    <div key={field.name} className="space-y-2">
                                                        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                                            {field.label}
                                                            <span className="text-gray-400 ml-1 text-xs font-normal">
                                                                {field.required ? "(必填)" : "(可选)"}
                                                            </span>
                                                        </Label>

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
                                                                <SelectTrigger className="w-full bg-white border-gray-200 focus:ring-1 focus:ring-black h-9">
                                                                    <SelectValue placeholder="请选择..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(field as SelectFieldConfig).options.map(opt => (
                                                                        <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : field.type === 'multi-select' ? (
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        disabled={isUploading}
                                                                        className="w-full justify-between bg-white border-gray-200 hover:bg-white hover:border-gray-300 font-normal px-3 h-9"
                                                                    >
                                                                        <span className="truncate text-sm">
                                                                            {((formData[field.name] as string[])?.length || 0) > 0
                                                                                ? `已选择 ${(formData[field.name] as string[]).length} 项`
                                                                                : "请选择..."}
                                                                        </span>
                                                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
                                                                    <div className="max-h-[300px] overflow-y-auto settings-scrollbar space-y-0.5">
                                                                        {(field as MultiSelectFieldConfig).options.map(opt => {
                                                                            const vals = (formData[field.name] as string[]) || [];
                                                                            const checked = vals.includes(opt);
                                                                            return (
                                                                                <div
                                                                                    key={opt}
                                                                                    className={`
                                                                                        flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors
                                                                                        ${checked ? "bg-black/5 text-black" : "text-gray-600 hover:bg-gray-100"}
                                                                                    `}
                                                                                    onClick={() => {
                                                                                        const newVals = checked
                                                                                            ? vals.filter(v => v !== opt)
                                                                                            : [...vals, opt];
                                                                                        updateNodeData(node.id, {
                                                                                            formData: { ...formData, [field.name]: newVals }
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    <div className={`
                                                                                        w-4 h-4 rounded border flex items-center justify-center transition-all
                                                                                        ${checked ? "bg-black border-black" : "border-gray-300 bg-white"}
                                                                                    `}>
                                                                                        {checked && <Check className="w-3 h-3 text-white" />}
                                                                                    </div>
                                                                                    <span className="text-sm font-medium">{opt}</span>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        ) : (
                                                            <Textarea
                                                                className="bg-white border-gray-200 focus:ring-1 focus:ring-black placeholder:text-gray-400 min-h-[60px] text-sm resize-none"
                                                                placeholder={field.type === 'text' ? (field.placeholder || "请输入...") : ""}
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

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                    <Button variant="ghost" onClick={closeDialog} disabled={isUploading} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isUploading}
                        className="bg-black text-white hover:bg-black/90 px-6 rounded-lg font-medium shadow-sm transition-all gap-2"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {isUploading ? "正在处理..." : "运行"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
