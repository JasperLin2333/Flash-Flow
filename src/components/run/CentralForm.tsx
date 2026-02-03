import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NodeForm } from "./NodeForm";
import type { InputNodeData } from "@/types/flow";
import { Play, Paperclip, UploadCloud, X } from "lucide-react";
import { showWarning } from "@/utils/errorNotify";
import { DEFAULT_FILE_CONFIG } from "@/components/builder/node-forms/InputNodeForm/constants";

interface CentralFormProps {
    inputNodeData: InputNodeData;
    onSend: (data: { text: string; files?: File[]; formData?: Record<string, unknown> }) => void;
    onFormDataChange?: (formData: Record<string, unknown>) => void;
    flowTitle?: string;
}

export function CentralForm({ inputNodeData, onSend, onFormDataChange, flowTitle }: CentralFormProps) {
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [text, setText] = useState("");
    const [textError, setTextError] = useState<string>("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [fileError, setFileError] = useState<string>("");
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Configs
    const formFields = useMemo(() => inputNodeData.formFields ?? [], [inputNodeData.formFields]);
    const greeting = inputNodeData.greeting || "请填写以下信息以开始对话";
    const enableFileInput = inputNodeData.enableFileInput === true;
    const enableTextInput = inputNodeData.enableTextInput !== false;
    const textRequired =
        (inputNodeData.enableTextInput !== false) &&
        (inputNodeData.textRequired === true);
    const fileRequired = enableFileInput && inputNodeData.fileRequired === true;
    const fileConfig = inputNodeData.fileConfig || DEFAULT_FILE_CONFIG;

    const acceptedTypeText = useMemo(() => {
        const allAllowed = (fileConfig.allowedTypes || [])
            .flatMap(t => t.split(',').map(s => s.trim()))
            .filter(Boolean);
        const isAnyTypeAllowed = allAllowed.some(t => t === "*/*" || t === "*");
        if (isAnyTypeAllowed || allAllowed.length === 0) return "任意类型";
        return allAllowed.join("、");
    }, [fileConfig.allowedTypes]);

    // Initialize form data
    useEffect(() => {
        const initialFormData: Record<string, unknown> = { ...(inputNodeData.formData || {}) };
        formFields.forEach((field) => {
            if (field.defaultValue && !(field.name in initialFormData)) {
                initialFormData[field.name] = field.defaultValue;
            }
        });
        setFormData(initialFormData);
        // Important: sync initial state back if needed, but be careful not to trigger loops
        // onFormDataChange?.(initialFormData); 
    }, [inputNodeData.formData, formFields]);

    const handleFieldChange = (fieldName: string, value: unknown) => {
        const newFormData = { ...formData, [fieldName]: value };
        setFormData(newFormData);
        setFormErrors(prev => ({ ...prev, [fieldName]: "" }));
        onFormDataChange?.(newFormData);
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        formFields.forEach((field) => {
            if (field.required) {
                const val = formData[field.name];
                const isEmpty = val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
                if (isEmpty) {
                    errors[field.name] = "此项必填";
                }
            }
        });
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const addFiles = (files: File[]) => {
        if (files.length === 0) return;

        const currentCount = selectedFiles.length;
        if (currentCount + files.length > fileConfig.maxCount) {
            showWarning("文件数量超限", `最多只能上传 ${fileConfig.maxCount} 个文件，当前已选择 ${currentCount} 个`);
            return;
        }

        const oversized = files.find(f => f.size > fileConfig.maxSizeMB * 1024 * 1024);
        if (oversized) {
            showWarning("文件过大", `文件 "${oversized.name}" 超过最大体积 ${fileConfig.maxSizeMB}MB`);
            return;
        }

        const allAllowed = (fileConfig.allowedTypes || [])
            .flatMap(t => t.split(',').map(s => s.trim().toLowerCase()))
            .filter(Boolean);

        const isAnyTypeAllowed = allAllowed.some(t => t === "*/*" || t === "*");
        if (!isAnyTypeAllowed && allAllowed.length > 0) {
            const invalid = files.find(f => {
                const fileName = f.name.toLowerCase();
                const fileType = f.type.toLowerCase();
                return !allAllowed.some(allowed => {
                    if (allowed === fileType) return true;
                    if (allowed.endsWith("/*")) {
                        const prefix = allowed.slice(0, -1);
                        return fileType.startsWith(prefix);
                    }
                    if (allowed.startsWith(".")) return fileName.endsWith(allowed);
                    return false;
                });
            });
            if (invalid) {
                showWarning("文件类型不支持", `不支持的文件类型: ${invalid.name}，仅支持: ${allAllowed.join(", ")}`);
                return;
            }
        }

        setSelectedFiles(prev => [...prev, ...files]);
        setFileError("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        addFiles(files);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        addFiles(Array.from(e.dataTransfer.files || []));
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleStart = () => {
        if (!validateForm()) return;
        if (textRequired && text.trim().length === 0) {
            setTextError("请输入文本内容");
            showWarning("缺少必填文本", "请输入文本内容后再开始对话");
            textInputRef.current?.focus();
            return;
        }
        if (fileRequired && selectedFiles.length === 0) {
            setFileError("请至少上传 1 个文件");
            showWarning("缺少必填文件", "请至少上传 1 个文件后再开始对话");
            fileInputRef.current?.click();
            return;
        }

        onSend({
            text: enableTextInput ? text.trim() : "",
            files: enableFileInput && selectedFiles.length > 0 ? selectedFiles : undefined,
            formData: formData
        });
    };

    return (
        <div className="max-w-xl mx-auto mt-20 px-6">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                    {flowTitle || "欢迎使用"}
                </h1>
                <p className="text-lg text-gray-500 leading-relaxed max-w-lg mx-auto">
                    {greeting}
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-black/5 overflow-hidden">
                <div className="p-8 bg-white/50 backdrop-blur-sm space-y-6">
                    <NodeForm
                        fields={formFields}
                        formData={formData}
                        formErrors={formErrors}
                        onChange={handleFieldChange}
                    />

                    {enableTextInput && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                补充说明
                                <span className="text-gray-400 ml-2 text-xs font-normal">
                                    ({textRequired ? "必填" : "可选"})
                                </span>
                            </label>
                            <Textarea
                                ref={textInputRef}
                                placeholder="输入您的问题或更多背景信息..."
                                className="min-h-[100px] resize-none border-gray-200 focus:border-black focus:ring-black/5"
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    setTextError("");
                                }}
                            />
                            {textError && (
                                <div className="text-xs text-red-600 font-medium">{textError}</div>
                            )}
                        </div>
                    )}

                    {enableFileInput && (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                                        <Paperclip className="w-4 h-4 text-gray-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-700">上传文件</div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            最多 {fileConfig.maxCount} 个 · 单个 ≤{fileConfig.maxSizeMB}MB · {acceptedTypeText}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className={[
                                        "px-2 py-0.5 rounded-full border text-xs font-medium shrink-0",
                                        fileRequired
                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "bg-gray-50 text-gray-500 border-gray-200",
                                    ].join(" ")}
                                >
                                    {fileRequired ? "必填" : "可选"}
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                                accept={(fileConfig.allowedTypes || []).join(",")}
                            />

                            <div
                                className={[
                                    "rounded-2xl border bg-white",
                                    "transition-colors",
                                    fileError ? "border-red-200 bg-red-50/20" : "border-gray-200",
                                ].join(" ")}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                            >
                                <button
                                    type="button"
                                    className={[
                                        "w-full text-left p-4",
                                        "flex items-center justify-between gap-4",
                                        "rounded-2xl",
                                        "hover:bg-gray-50/60 active:bg-gray-50",
                                        "transition-colors",
                                    ].join(" ")}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center shrink-0">
                                            <UploadCloud className="w-5 h-5 text-gray-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-700">
                                                点击选择文件或拖拽到这里
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                {selectedFiles.length > 0
                                                    ? `已选择 ${selectedFiles.length} 个文件`
                                                    : fileRequired
                                                        ? "需要至少 1 个文件才能开始对话"
                                                        : "你也可以不上传文件直接开始"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium text-gray-600 px-3 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center shrink-0">
                                        选择文件
                                    </div>
                                </button>

                                {selectedFiles.length > 0 && (
                                    <div className="px-4 pb-4">
                                        <div className="grid grid-cols-1 gap-2">
                                            {selectedFiles.map((f, idx) => (
                                                <div
                                                    key={`${f.name}-${f.size}-${idx}`}
                                                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/60"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-gray-700 truncate" title={f.name}>
                                                            {f.name}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {(f.size / 1024 / 1024).toFixed(2)}MB
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-red-50 hover:border-red-200 text-gray-500 hover:text-red-600 flex items-center justify-center transition-colors shrink-0"
                                                        onClick={() => removeFile(idx)}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {fileError && (
                                <div className="text-xs text-red-600 font-medium">{fileError}</div>
                            )}
                        </div>
                    )}

                    <div className="pt-2 flex justify-end">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto rounded-xl text-base px-8 h-12 bg-black hover:bg-black/90 text-white shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            onClick={handleStart}
                        >
                            <Play className="w-4 h-4 mr-2 fill-current" />
                            开始对话
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
