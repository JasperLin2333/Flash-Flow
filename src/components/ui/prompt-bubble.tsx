"use client";
import { Send, Paperclip, BookOpen, X, File as FileIcon, Image as ImageIcon, FileText } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { InputNodeData, FormFieldConfig, SelectFieldConfig, TextFieldConfig, MultiSelectFieldConfig } from "@/types/flow";

interface PromptBubbleProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  singleLine?: boolean;
  minRows?: number;

  // Optional Input node enhancement  
  inputNodeData?: InputNodeData;
  onFileSelect?: (files: File[]) => void;
  onFileRemove?: (file: File) => void;
  onFormDataChange?: (formData: Record<string, unknown>) => void;
  selectedFiles?: File[];
}

// File type icon helper
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return ImageIcon;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) return FileText;
  return FileIcon;
};

export default function PromptBubble(props: PromptBubbleProps) {
  const {
    value,
    onChange,
    onSubmit,
    placeholder = "有想法，尽管说~",
    disabled,
    className,
    inputNodeData,
    onFileSelect,
    onFileRemove,
    onFormDataChange,
    selectedFiles = [],
  } = props;

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formPopoverOpen, setFormPopoverOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Determine enabled features from Input node data
  const enableTextInput = inputNodeData?.enableTextInput !== false; // Default: true
  const enableFileInput = inputNodeData?.enableFileInput === true;
  const enableStructuredForm = inputNodeData?.enableStructuredForm === true;
  const formFields = inputNodeData?.formFields || [];
  const fileConfig = inputNodeData?.fileConfig || { allowedTypes: ["*/*"], maxSizeMB: 100, maxCount: 10 };

  // 使用 ref 存储回调，避免作为 useEffect 依赖导致无限循环
  const onFormDataChangeRef = useRef(onFormDataChange);
  onFormDataChangeRef.current = onFormDataChange;

  // 稳定化 formFields 依赖，只在字段实际变更时触发
  const formFieldsKey = useMemo(
    () => JSON.stringify(formFields.map(f => ({ name: f.name, defaultValue: f.defaultValue }))),
    [formFields]
  );

  // Initialize form data with default values
  useEffect(() => {
    if (enableStructuredForm && formFields.length > 0) {
      const initialFormData: Record<string, unknown> = {};
      formFields.forEach((field) => {
        if (field.defaultValue) {
          initialFormData[field.name] = field.defaultValue;
        }
      });
      setFormData(initialFormData);
      onFormDataChangeRef.current?.(initialFormData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableStructuredForm, formFieldsKey]);

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

  // 发送按钮是否可用（必填字段已填）
  const canSend = !hasRequiredFields || allRequiredFilled;

  // 根据启用的模式判断是否有有效内容
  const hasValidContent =
    (enableTextInput && value.trim().length > 0) ||
    (enableFileInput && selectedFiles.length > 0) ||
    (enableStructuredForm && isFormFilled);
  const canSubmit = !disabled && canSend && hasValidContent;

  // 需要高亮提示配置按钮（有必填字段但未填完）
  const needsFormAttention = hasRequiredFields && !allRequiredFilled;

  // 根据配置组合生成友好的 placeholder 提示语
  const getPlaceholder = (): string => {
    if (!enableTextInput && enableFileInput && enableStructuredForm) {
      return "📎 点击左下角上传文件，或点击 📖 填写表单后发送~";
    }
    if (!enableTextInput && enableFileInput) {
      return "📎 点击左下角上传您的文件即可开始~";
    }
    if (!enableTextInput && enableStructuredForm) {
      return "📖 点击左下角填写表单后即可开始~";
    }
    if (enableStructuredForm && formFields.some(f => f.required)) {
      return "搜索、提问或者说明你的需求...";
    }
    return placeholder;
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Allow submit only when canSubmit is true
        if (canSubmit) onSubmit();
      }
    },
    [onSubmit, canSubmit]
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const currentCount = selectedFiles.length;

    if (currentCount + files.length > fileConfig.maxCount) {
      toast({
        title: "文件数量超限",
        description: `最多只能上传 ${fileConfig.maxCount} 个文件，当前已上传 ${currentCount} 个`,
        variant: "destructive",
      });
      return;
    }

    const oversizedFiles = files.filter(f => f.size > fileConfig.maxSizeMB * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "文件过大",
        description: `文件 "${oversizedFiles[0].name}" 超过最大体积 ${fileConfig.maxSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }

    onFileSelect?.(files);
    // Reset input so same file can be selected again if needed
    event.target.value = "";
  };

  // 表单字段变化时自动保存
  const handleFieldChange = (fieldName: string, value: unknown) => {
    const newFormData = { ...formData, [fieldName]: value };
    setFormData(newFormData);
    setFormErrors({ ...formErrors, [fieldName]: "" });
    // 自动保存
    onFormDataChange?.(newFormData);
  };

  return (
    <div
      className={cn(
        "relative w-full bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 flex flex-col",
        className
      )}
    >
      {/* Top: File Previews */}
      {selectedFiles.length > 0 && (
        <div className="flex gap-3 p-3 border-b border-gray-50 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          {selectedFiles.map((file, i) => {
            const Icon = getFileIcon(file.name);
            return (
              <div key={i} className="group relative flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 min-w-[200px] max-w-[240px] shrink-0">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-gray-100 text-gray-500 shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-gray-400 truncate">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {onFileRemove && (
                  <button
                    onClick={() => onFileRemove(file)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Middle: Text Area */}
      <div className="relative px-3 py-2">
        <TextareaAutosize
          ref={taRef}
          minRows={props.minRows ? props.minRows : (props.singleLine ? 1 : 3)}
          maxRows={12}
          value={value}
          onChange={(e) => enableTextInput && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={!enableTextInput}
          className={`w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed placeholder-gray-400 outline-none px-1 py-1 ${enableTextInput ? 'text-gray-900 cursor-text' : 'text-gray-400 cursor-default'
            }`}
        />
      </div>

      {/* Bottom: Toolbar */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        {/* Left: Config Buttons */}
        <div className="flex items-center gap-1">
          {/* File Upload */}
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
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 w-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="w-fit p-3 space-y-1.5">
                  <p className="font-semibold text-sm">上传附件</p>
                  <div className="text-xs space-y-1 text-gray-200">
                    {(() => {
                      const validTypes = fileConfig.allowedTypes
                        .flatMap(t => t.split(','))
                        .map(t => t.trim())
                        .filter(t => t && t !== "*/*" && t !== "*");
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

          {/* Form Config */}
          {enableStructuredForm && formFields.length > 0 && (
            <Popover open={formPopoverOpen} onOpenChange={setFormPopoverOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-lg transition-all duration-200",
                        needsFormAttention
                          ? "text-white bg-black hover:bg-black/90 ring-2 ring-gray-300 ring-offset-1 animate-pulse"
                          : isFormFilled
                            ? "text-gray-900 bg-gray-100 hover:bg-gray-200"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <BookOpen className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="w-fit p-3 space-y-1.5">
                  <p className="font-semibold text-sm">填写表单</p>
                  <div className="text-xs text-gray-200">
                    <p className="text-gray-400 mb-1">点击填写以下信息：</p>
                    <div className="flex flex-wrap gap-1">
                      {formFields.map((field, i) => (
                        <span key={i} className={cn(
                          "inline-block rounded px-1.5 py-0.5",
                          field.required ? "bg-black" : "bg-gray-700"
                        )}>
                          {field.label}{field.required && " *"}
                        </span>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-80 p-4 space-y-3" side="top" align="start">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">填写表单</h4>
                  <Button
                    type="button"
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
                          onValueChange={(val) => handleFieldChange(field.name, val)}
                        >
                          <SelectTrigger className={`${hasError ? "border-red-500" : "border-gray-200"} h-9`}>
                            <SelectValue placeholder="请选择" />
                          </SelectTrigger>
                          <SelectContent>
                            {(field as SelectFieldConfig).options.map((opt) => {
                              const optValue = typeof opt === 'object' && opt !== null ? (opt as { value: string }).value : opt;
                              const optLabel = typeof opt === 'object' && opt !== null ? (opt as { label: string }).label : opt;
                              return (
                                <SelectItem key={optValue} value={optValue}>
                                  {optLabel}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : field.type === "multi-select" ? (
                        <div className={`border rounded-md p-2 space-y-2 max-h-40 overflow-y-auto ${hasError ? "border-red-500" : "border-gray-200"}`}>
                          {(field as MultiSelectFieldConfig).options.map((opt) => {
                            const optValue = typeof opt === 'object' && opt !== null ? (opt as { value: string }).value : opt;
                            const optLabel = typeof opt === 'object' && opt !== null ? (opt as { label: string }).label : opt;
                            const currentVals = (formData[field.name] as string[]) || [];
                            return (
                              <div key={optValue} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`${field.name}-${optValue}`}
                                  checked={currentVals.includes(optValue)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    let newVals = [...currentVals];
                                    if (checked) {
                                      newVals.push(optValue);
                                    } else {
                                      newVals = newVals.filter(v => v !== optValue);
                                    }
                                    handleFieldChange(field.name, newVals);
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                                />
                                <label
                                  htmlFor={`${field.name}-${optValue}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {optLabel}
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <Input
                          placeholder={"请输入..."}
                          value={(formData[field.name] as string) || ""}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
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
        </div>

        {/* Right: Send Button */}
        <Button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
          disabled={!canSubmit}
          className={cn(
            "h-8 w-8 rounded-full p-0 flex items-center justify-center transition-all duration-200",
            canSubmit
              ? "bg-black text-white hover:bg-black/90 shadow-sm"
              : needsFormAttention
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
          )}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
