"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Send, Paperclip, Settings, X } from "lucide-react";
import type { InputNodeData, FormFieldConfig, SelectFieldConfig, TextFieldConfig, MultiSelectFieldConfig } from "@/types/flow";

interface InputBarProps {
    inputNode: InputNodeData;
    value: string;
    onChange: (value: string) => void;
    onSend: (data: { text: string; files?: File[]; formData?: Record<string, unknown> }) => void;
    disabled?: boolean;
    className?: string;
}

export function InputBar({ inputNode, value, onChange, onSend, disabled, className }: InputBarProps) {
    const [formPopoverOpen, setFormPopoverOpen] = useState(false);
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine which capabilities are enabled
    const enableTextInput = inputNode.enableTextInput !== false; // Default true
    const enableFileInput = inputNode.enableFileInput === true;
    const enableStructuredForm = inputNode.enableStructuredForm === true;
    const formFields = inputNode.formFields || [];
    const fileConfig = inputNode.fileConfig || { allowedTypes: ["*/*"], maxSizeMB: 50, maxCount: 999 };

    // Initialize form data with default values
    useState(() => {
        const initialFormData: Record<string, unknown> = {};
        formFields.forEach((field) => {
            if (field.defaultValue) {
                initialFormData[field.name] = field.defaultValue;
            }
        });
        setFormData(initialFormData);
    });

    // Check if form has any filled values (for visual feedback)
    const isFormFilled = formFields.length > 0 && Object.keys(formData).some(key => formData[key]);

    // 必填字段验证逻辑
    const hasRequiredFields = formFields.some(f => f.required);
    const allRequiredFilled = formFields
        .filter(f => f.required)
        .every(f => {
            const val = formData[f.name];
            if (Array.isArray(val)) return val.length > 0;
            return val !== undefined && val !== null && String(val).trim() !== '';
        });

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

        // Validate file count
        if (files.length > fileConfig.maxCount) {
            alert(`最多只能上传 ${fileConfig.maxCount} 个文件`);
            return;
        }

        // Validate file size
        const oversizedFiles = files.filter(f => f.size > fileConfig.maxSizeMB * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            alert(`文件 "${oversizedFiles[0].name}" 超过最大体积 ${fileConfig.maxSizeMB}MB`);
            return;
        }

        setSelectedFiles(files);
    };

    // Handle sending
    const handleSendClick = () => {
        // 如果有必填字段未填写，阻止发送
        if (hasRequiredFields && !allRequiredFilled) {
            setFormPopoverOpen(true);
            validateForm(); // 显示错误信息
            return;
        }

        if (disabled || !value.trim()) return;

        // If structured form is enabled, validate required fields
        if (enableStructuredForm && formFields.some(f => f.required)) {
            if (!validateForm()) {
                // Auto-open form popover to show errors
                setFormPopoverOpen(true);
                return;
            }
        }

        // Package all data and send
        onSend({
            text: value,
            files: enableFileInput && selectedFiles.length > 0 ? selectedFiles : undefined,
            formData: enableStructuredForm && Object.keys(formData).length > 0 ? formData : undefined,
        });

        // Reset state
        setSelectedFiles([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };



    return (
        <div className={`flex items-end gap-2 ${className || ""}`}>
            {/* Left: Form trigger button (if structured form enabled) */}
            {enableStructuredForm && (
                <Popover open={formPopoverOpen} onOpenChange={setFormPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`h-10 w-10 rounded-xl transition-all ${isFormFilled
                                ? "border-black bg-black text-white hover:bg-black/90"
                                : "border-gray-300 hover:border-gray-400"
                                }`}
                        >
                            <Settings className="w-4 h-4" />
                            {isFormFilled && <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full" />}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4 space-y-3" side="top" align="start">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">配置参数</h4>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setFormPopoverOpen(false)}
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </div>

                        {formFields.map((field) => {
                            const hasError = !!formErrors[field.name];

                            return (
                                <div key={field.name} className="space-y-2">
                                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500">*</span>}
                                    </label>

                                    {field.type === "select" ? (
                                        <Select
                                            value={formData[field.name] as string || ""}
                                            onValueChange={(val) => {
                                                setFormData(prev => ({ ...prev, [field.name]: val }));
                                                setFormErrors(prev => ({ ...prev, [field.name]: "" }));
                                            }}
                                        >
                                            <SelectTrigger
                                                className={`${hasError ? "border-red-500" : "border-gray-200"} h-9`}
                                            >
                                                <SelectValue placeholder="请选择" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(field as SelectFieldConfig).options.map((opt) => (
                                                    <SelectItem key={opt} value={opt}>
                                                        {opt}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : field.type === "multi-select" ? (
                                        <div className={`border rounded-md p-2 space-y-2 max-h-40 overflow-y-auto ${hasError ? "border-red-500" : "border-gray-200"}`}>
                                            {(field as MultiSelectFieldConfig).options.map((opt) => {
                                                const currentVals = (formData[field.name] as string[]) || [];
                                                return (
                                                    <div key={opt} className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id={`${field.name}-${opt}`}
                                                            checked={currentVals.includes(opt)}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                let newVals = [...currentVals];
                                                                if (checked) {
                                                                    newVals.push(opt);
                                                                } else {
                                                                    newVals = newVals.filter(v => v !== opt);
                                                                }
                                                                setFormData(prev => ({ ...prev, [field.name]: newVals }));
                                                                setFormErrors(prev => ({ ...prev, [field.name]: "" }));
                                                            }}
                                                            className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                                                        />
                                                        <label
                                                            htmlFor={`${field.name}-${opt}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                        >
                                                            {opt}
                                                        </label>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder={"请输入..."}
                                            value={(formData[field.name] as string) || ""}
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, [field.name]: e.target.value }));
                                                setFormErrors(prev => ({ ...prev, [field.name]: "" }));
                                            }}
                                            className={`${hasError ? "border-red-500" : "border-gray-200"} h-9`}
                                        />
                                    )}

                                    {hasError && <p className="text-xs text-red-500">{formErrors[field.name]}</p>}
                                </div>
                            );
                        })}

                    </PopoverContent>
                </Popover>
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
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-8 w-8 hover:bg-gray-100"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Paperclip className="w-4 h-4 text-gray-500" />
                        </Button>
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
