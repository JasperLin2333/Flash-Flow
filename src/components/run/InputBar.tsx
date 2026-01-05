"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Paperclip, BookOpen, X, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { NodeForm } from "./NodeForm";
import type { InputNodeData, FormFieldConfig, SelectFieldConfig, TextFieldConfig, MultiSelectFieldConfig } from "@/types/flow";
import { showWarning } from "@/utils/errorNotify";

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
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine which capabilities are enabled
    const enableTextInput = inputNode.enableTextInput !== false; // Default true
    const enableFileInput = inputNode.enableFileInput === true;
    const enableStructuredForm = inputNode.enableStructuredForm === true;
    const formFields = inputNode.formFields || [];
    const fileConfig = inputNode.fileConfig || { allowedTypes: ["*/*"], maxSizeMB: 50, maxCount: 10 };

    // Initialize form data with default values, sync with existing inputNode.formData
    useState(() => {
        const initialFormData: Record<string, unknown> = inputNode.formData || {};
        // Fill in default values for fields that don't have values yet
        formFields.forEach((field) => {
            if (field.defaultValue && !(field.name in initialFormData)) {
                initialFormData[field.name] = field.defaultValue;
            }
        });
        setFormData(initialFormData);
    });

    // Check if form has any filled values (for visual feedback)
    const isFormFilled = enableStructuredForm && formFields.length > 0 && Object.keys(formData).some(key => formData[key]);

    // 必填字段验证逻辑
    const hasRequiredFields = enableStructuredForm && formFields.some(f => f.required);
    const allRequiredFilled = enableStructuredForm ? formFields
        .filter(f => f.required)
        .every(f => {
            const val = formData[f.name];
            if (Array.isArray(val)) return val.length > 0;
            return val !== undefined && val !== null && String(val).trim() !== '';
        }) : true;

    // Validate required form fields
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        formFields.forEach((field) => {
            if (field.required && !formData[field.name]) {
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
        // If * or */* is present, or if the array is empty (which technically might mean nothing allowed, but usually implies default behavior, though here we treat empty as strict if strict mode was intended? No, usually empty = nothing allowed. But let's assume * is the default in config if not set. Wait, default is defined as ["*/*"].
        // If allowedTypes is explicitly empty, we should probably block everything? 
        // Based on logic, if not * and not empty, we check.
        const isAnyTypeAllowed = allAllowed.some(t => t === '*/*' || t === '*');

        if (!isAnyTypeAllowed && allAllowed.length > 0) {
            const invalidTypeFiles = files.filter(f => {
                const fileName = f.name.toLowerCase();
                return !allAllowed.some(allowed => fileName.endsWith(allowed));
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
        // 如果启用了文本输入但用户未输入文本，直接提示用户
        if (enableTextInput && !value.trim()) {
            showWarning("请输入内容", "请输入文本后再发送");
            return;
        }

        // 如果有必填字段未填写，阻止发送
        if (hasRequiredFields && !allRequiredFilled) {
            setFormDialogOpen(true);
            validateForm(); // 显示错误信息
            return;
        }

        // 统一发送条件：至少有一个启用的模式有内容
        const hasValidContent =
            (enableTextInput && value.trim().length > 0) ||
            (enableFileInput && selectedFiles.length > 0) ||
            (enableStructuredForm && Object.keys(formData).length > 0);
        if (disabled || !hasValidContent) return;

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

        // Reset form data to defaults
        const resetFormData: Record<string, unknown> = inputNode.formData || {};
        formFields.forEach((field) => {
            if (field.defaultValue && !(field.name in resetFormData)) {
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
                    (!enableTextInput && !enableFileInput && !enableStructuredForm) ||
                    (!value.trim() && !enableFileInput && !enableStructuredForm)
                }
                className="h-10 w-10 rounded-xl bg-black hover:bg-black/90 disabled:opacity-50"
            >
                <Send className="w-4 h-4" />
            </Button>
        </div>
    );
}
