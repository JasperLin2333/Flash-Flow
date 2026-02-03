"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Paperclip, BookOpen, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { NodeForm } from "./NodeForm";
import type { InputNodeData } from "@/types/flow";
import { showWarning } from "@/utils/errorNotify";
import { DEFAULT_FILE_CONFIG } from "@/components/builder/node-forms/InputNodeForm/constants";
import { isFieldEmpty } from "@/store/utils/inputValidation";

interface InputBarProps {
    inputNode: InputNodeData;
    value: string;
    onChange: (value: string) => void;
    onSend: (data: { text: string; files?: File[]; formData?: Record<string, unknown> }) => void;
    onFormDataChange?: (formData: Record<string, unknown>) => void;
    disabled?: boolean;
    className?: string;
}

export function InputBar({ inputNode, value, onChange, onSend, onFormDataChange, disabled, className }: InputBarProps) {
    const [formDialogOpen, setFormDialogOpen] = useState(false);
    // Bug 1 Fix: 正确使用 useState 初始化函数，返回值而非调用 setState
    const [formData, setFormData] = useState<Record<string, unknown>>(() => {
        const initialFormData: Record<string, unknown> = { ...(inputNode.formData || {}) };
        // Fill in default values for fields that don't have values yet
        (inputNode.formFields || []).forEach((field) => {
            if (field.defaultValue !== undefined && !(field.name in initialFormData)) {
                initialFormData[field.name] = field.defaultValue;
            }
        });
        return initialFormData;
    });
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine which capabilities are enabled

    const enableFileInput = inputNode.enableFileInput === true;
    const enableTextInput = inputNode.enableTextInput !== false;
    const textRequired = enableTextInput && inputNode.textRequired === true;
    const enableStructuredForm = inputNode.enableStructuredForm === true;
    const fileRequired = enableFileInput && inputNode.fileRequired === true;
    const formFields = inputNode.formFields || [];
    const fileConfig = inputNode.fileConfig || DEFAULT_FILE_CONFIG;

    // Check if form has any filled values (for visual feedback)
    const isFormFilled =
        enableStructuredForm &&
        formFields.length > 0 &&
        Object.keys(formData).some((key) => !isFieldEmpty(formData[key]));

    // 必填字段验证逻辑
    const hasRequiredFields = enableStructuredForm && formFields.some(f => f.required);
    const allRequiredFilled = enableStructuredForm
        ? formFields
              .filter((f) => f.required)
              .every((f) => !isFieldEmpty(formData[f.name]))
        : true;

    const allRequiredFilesSelected = !fileRequired || selectedFiles.length > 0;
    const allRequiredTextFilled = !textRequired || value.trim().length > 0;

    const hasText = value.trim().length > 0;
    const hasValidContent = textRequired
        ? hasText
        : (
            (enableTextInput && hasText) ||
            (enableFileInput && selectedFiles.length > 0) ||
            (enableStructuredForm && Object.keys(formData).length > 0)
        );

    // Validate required form fields
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        formFields.forEach((field) => {
            if (field.required && isFieldEmpty(formData[field.name])) {
                errors[field.name] = "此字段为必填项";
            }
        });
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle file selection
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        const currentCount = selectedFiles.length;

        // Validate cumulative file count
        if (currentCount + files.length > fileConfig.maxCount) {
            showWarning("文件数量超限", `最多只能上传 ${fileConfig.maxCount} 个文件，当前已选择 ${currentCount} 个`);
            return;
        }

        // Validate file size for new files
        // Validate file size for new files
        const oversizedFiles = files.filter(f => f.size > fileConfig.maxSizeMB * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            showWarning("文件过大", `文件 "${oversizedFiles[0].name}" 超过最大体积 ${fileConfig.maxSizeMB}MB`);
            return;
        }

        // Validate file type
        const allAllowed = fileConfig.allowedTypes.flatMap(t => t.split(',').map(s => s.trim().toLowerCase()));

        const isAnyTypeAllowed = allAllowed.some(t => t === '*/*' || t === '*');

        if (!isAnyTypeAllowed && allAllowed.length > 0) {
            const invalidTypeFiles = files.filter(f => {
                const fileName = f.name.toLowerCase();
                const fileType = f.type.toLowerCase();

                return !allAllowed.some(allowed => {
                    // 1. Check exact MIME type match (e.g., "application/pdf")
                    if (allowed === fileType) return true;

                    // 2. Check wildcard MIME type match (e.g., "image/*")
                    if (allowed.endsWith('/*')) {
                        const prefix = allowed.slice(0, -1); // "image/"
                        return fileType.startsWith(prefix);
                    }

                    // 3. Check file extension match (e.g., ".pdf")
                    if (allowed.startsWith('.')) {
                        return fileName.endsWith(allowed);
                    }

                    // Fallback: strict equality (though covered by 1, explicit safely)
                    return allowed === fileName;
                });
            });

            if (invalidTypeFiles.length > 0) {
                showWarning("文件类型不支持", `不支持的文件类型: ${invalidTypeFiles[0].name}，仅支持: ${allAllowed.join(", ")}`);
                return;
            }
        }

        // Combine with existing files
        setSelectedFiles(prevFiles => [...prevFiles, ...files]);

        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Handle sending
    const handleSendClick = () => {
        // 如果有必填字段未填写，阻止发送
        if (hasRequiredFields && !allRequiredFilled) {
            setFormDialogOpen(true);
            validateForm(); // 显示错误信息
            return;
        }

        if (textRequired && value.trim().length === 0) {
            showWarning("缺少必填文本", "请输入文本内容后再发送");
            return;
        }

        if (fileRequired && selectedFiles.length === 0) {
            showWarning("缺少必填文件", "请至少上传 1 个文件后再发送");
            fileInputRef.current?.click();
            return;
        }

        // Bug 4 Fix: 统一发送条件，至少有一个启用的模式有内容
        // 移除了之前强制要求文本的矛盾逻辑
        if (disabled || !hasValidContent) {
            if (textRequired) {
                showWarning("缺少必填文本", "请输入文本内容后再发送");
            } else {
                showWarning("请输入内容", "请至少输入文本、上传文件或填写表单");
            }
            return;
        }

        // Package all data and send
        onSend({
            text: enableTextInput ? value : "", // 如果关闭文本输入，传递空字符串
            files: enableFileInput && selectedFiles.length > 0 ? selectedFiles : undefined,
            formData: enableStructuredForm && Object.keys(formData).length > 0 ? formData : undefined,
        });

        // Reset state
        setSelectedFiles([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        // Bug 5 Fix: 重置为纯默认值，而非从 inputNode.formData 开始
        const resetFormData: Record<string, unknown> = {};
        formFields.forEach((field) => {
            if (field.defaultValue !== undefined) {
                resetFormData[field.name] = field.defaultValue;
            }
        });
        setFormData(resetFormData);
        // Also notify parent of change if needed, though usually just for local state here
        onFormDataChange?.(resetFormData);
    };



    return (
        <div className={`flex items-end gap-2 ${className || ""}`}>
            {/* Left: Form trigger button (if structured form enabled) */}
            {/* Left: Form trigger button (if structured form enabled) */}
            {enableStructuredForm && (
                <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className={`h-10 w-10 rounded-xl transition-all ${isFormFilled
                                        ? "border-black bg-black text-white hover:bg-black/90"
                                        : "border-gray-300 hover:border-gray-400"
                                        }`}
                                >
                                    <BookOpen className="w-4 h-4" />
                                    {isFormFilled && <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full" />}
                                </Button>
                            </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="w-fit p-3 space-y-1.5">
                            <p className="font-semibold text-sm">📋 填写表单</p>
                            <div className="text-xs text-gray-200">
                                <p className="text-gray-400 mb-1">点击填写以下信息：</p>
                                <div className="flex flex-wrap gap-1">
                                    {formFields.map((field, i) => (
                                        <span key={i} className={`inline-block rounded px-1.5 py-0.5 ${field.required ? "bg-black" : "bg-gray-700"}`}>
                                            {field.label}{field.required && " *"}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </TooltipContent>
                    </Tooltip>

                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-xl">
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <DialogTitle className="text-xl font-bold text-gray-900 tracking-tight">填写表单</DialogTitle>
                        </DialogHeader>

                        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                            <NodeForm
                                fields={formFields}
                                formData={formData}
                                formErrors={formErrors}
                                onChange={(name, val) => {
                                    const newData = { ...formData, [name]: val };
                                    setFormData(newData);
                                    setFormErrors(prev => ({ ...prev, [name]: "" }));
                                    onFormDataChange?.(newData);
                                }}
                            />
                        </div>

                        <DialogFooter className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" className="rounded-xl">取消</Button>
                            </DialogClose>
                            <Button
                                onClick={() => setFormDialogOpen(false)}
                                className="rounded-xl bg-black text-white hover:bg-black/90 shadow-lg shadow-black/10"
                            >
                                确认
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Center: Main input area with optional file attachment */}
            <div className="flex-1 relative">
                <Textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendClick();
                        }
                    }}
                    placeholder={enableTextInput ? "输入消息..." : ""}
                    disabled={disabled}
                    className="min-h-[48px] resize-none pr-12 rounded-xl border-gray-300 focus:border-black focus:ring-black/10"
                />

                {/* File attachment button (inside input on the right) */}
                {enableFileInput && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple={fileConfig.maxCount > 1}
                            accept={fileConfig.allowedTypes.join(",")}
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-2 h-8 w-8 hover:bg-gray-100"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="w-4 h-4 text-gray-500" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="w-fit p-3 space-y-1.5">
                                <p className="font-semibold text-sm">上传附件</p>
                                <div className="text-xs space-y-1 text-gray-200">
                                    {(() => {
                                        const validTypes = [...new Set(
                                            fileConfig.allowedTypes
                                                .flatMap(t => t.split(','))
                                                .map(t => t.trim().toLowerCase())
                                                .filter(t => t && t !== "*/*" && t !== "*")
                                        )];
                                        return validTypes.length > 0 ? (
                                            <p className="flex flex-wrap gap-1 items-center">
                                                <span className="text-gray-400 shrink-0">支持格式：</span>
                                                {validTypes.map((t, i) => (
                                                    <span key={i} className="inline-block bg-gray-700 rounded px-1.5 py-0.5">{t.replace(/^\./, "")}</span>
                                                ))}
                                            </p>
                                        ) : null;
                                    })()}
                                    <p><span className="text-gray-400">单文件最大：</span>{fileConfig.maxSizeMB}MB</p>
                                    <p><span className="text-gray-400">最多上传：</span>{fileConfig.maxCount} 个</p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </>
                )}

                {/* Selected files preview */}
                {selectedFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {selectedFiles.map((file, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs"
                            >
                                <span className="max-w-[150px] truncate">{file.name}</span>
                                <button
                                    onClick={() => setSelectedFiles(selectedFiles.filter((_, idx) => idx !== i))}
                                    className="hover:text-red-500"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Right: Send button */}
            <Button
                onClick={handleSendClick}
                disabled={
                    disabled ||
                    (hasRequiredFields && !allRequiredFilled) ||
                    !allRequiredFilesSelected ||
                    !allRequiredTextFilled ||
                    (!enableTextInput && !enableFileInput && !enableStructuredForm) ||
                    !hasValidContent
                }
                className="h-10 w-10 rounded-xl bg-black hover:bg-black/90 disabled:opacity-50"
            >
                <Send className="w-4 h-4" />
            </Button>
        </div>
    );
}
