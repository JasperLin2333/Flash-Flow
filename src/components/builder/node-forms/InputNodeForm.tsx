"use client";
import { useState, useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { FormFieldConfig, SelectFieldConfig, TextFieldConfig, FileInputConfig, MultiSelectFieldConfig } from "@/types/flow";

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";
const SECTION_TITLE_CLASS = "text-xs font-semibold text-gray-700 flex items-center gap-2";

interface InputNodeFormProps {
  form: any;
  selectedNodeId?: string;
  updateNodeData?: (id: string, data: any) => void;
}

export function InputNodeForm({ form, selectedNodeId, updateNodeData }: InputNodeFormProps) {
  const [enableTextInput, setEnableTextInput] = useState<boolean>(
    form.getValues("enableTextInput") !== false // Default true
  );
  const [enableFileInput, setEnableFileInput] = useState<boolean>(
    form.getValues("enableFileInput") || false
  );
  const [enableStructuredForm, setEnableStructuredForm] = useState<boolean>(
    form.getValues("enableStructuredForm") || false
  );
  const [formFields, setFormFields] = useState<FormFieldConfig[]>(
    form.getValues("formFields") || []
  );
  const [fileConfig, setFileConfig] = useState<FileInputConfig>(
    form.getValues("fileConfig") || {
      allowedTypes: ["*/*"], // All files by default
      maxSizeMB: 50, // Customizable, default 50MB
      maxCount: 999, // Effectively unlimited
    }
  );

  // File type options for multi-select checkboxes
  const FILE_TYPE_OPTIONS = [
    { value: "image/*", label: "图片 (image/*)" },
    { value: ".pdf", label: "PDF (.pdf)" },
    { value: ".doc,.docx", label: "Word 文档 (.doc, .docx)" },
    { value: ".xls,.xlsx", label: "Excel 表格 (.xls, .xlsx)" },
    { value: ".ppt,.pptx", label: "PowerPoint (.ppt, .pptx)" },
    { value: ".txt", label: "文本文件 (.txt)" },
    { value: ".md", label: "Markdown (.md)" },
    { value: ".json", label: "JSON (.json)" },
    { value: ".csv", label: "CSV (.csv)" },
  ];

  // Update form values when state changes
  const updateFormValue = (key: string, value: any) => {
    form.setValue(key, value);
    if (selectedNodeId && updateNodeData) {
      updateNodeData(selectedNodeId, { [key]: value });
    }
  };

  const handleTextInputToggle = (checked: boolean) => {
    setEnableTextInput(checked);
    updateFormValue("enableTextInput", checked);
  };

  const handleFileInputToggle = (checked: boolean) => {
    setEnableFileInput(checked);
    updateFormValue("enableFileInput", checked);
    if (checked && !form.getValues("fileConfig")) {
      updateFormValue("fileConfig", fileConfig);
    }
  };

  const handleStructuredFormToggle = (checked: boolean) => {
    setEnableStructuredForm(checked);
    updateFormValue("enableStructuredForm", checked);
    if (checked && formFields.length === 0) {
      // Initialize with empty array if enabling for first time
      updateFormValue("formFields", []);
    }
  };

  // Sync local state with form values when node changes
  useEffect(() => {
    const currentEnableText = form.getValues("enableTextInput");
    const currentEnableFile = form.getValues("enableFileInput");
    const currentEnableForm = form.getValues("enableStructuredForm");
    const currentFileConfig = form.getValues("fileConfig");
    const currentFormFields = form.getValues("formFields");

    setEnableTextInput(currentEnableText !== false); // Default true
    setEnableFileInput(currentEnableFile || false);
    setEnableStructuredForm(currentEnableForm || false);

    if (currentFileConfig) {
      setFileConfig(currentFileConfig);
    }
    if (currentFormFields) {
      setFormFields(currentFormFields);
    }
  }, [selectedNodeId, form]);

  const handleAddField = () => {
    const newField: TextFieldConfig = {
      type: "text",
      name: `field_${Date.now()}`,
      label: "新字段",
      required: false,
    };
    const updatedFields = [...formFields, newField];
    setFormFields(updatedFields);
    updateFormValue("formFields", updatedFields);
  };

  const handleDeleteField = (index: number) => {
    const updatedFields = formFields.filter((_, i) => i !== index);
    setFormFields(updatedFields);
    updateFormValue("formFields", updatedFields);
  };

  const handleFieldUpdate = (index: number, updates: Partial<FormFieldConfig>) => {
    const updatedFields = formFields.map((field, i) => {
      if (i !== index) return field;
      return { ...field, ...updates } as FormFieldConfig;
    });
    setFormFields(updatedFields);
    updateFormValue("formFields", updatedFields);
  };

  const handleFieldTypeChange = (index: number, newType: "select" | "text" | "multi-select") => {
    const currentField = formFields[index];
    let newField: FormFieldConfig;

    if (newType === "select") {
      newField = {
        type: "select",
        name: currentField.name,
        label: currentField.label,
        options: ["选项1", "选项2"],
        required: currentField.required,
        defaultValue: "选项1",
      } as SelectFieldConfig;
    } else if (newType === "multi-select") {
      newField = {
        type: "multi-select",
        name: currentField.name,
        label: currentField.label,
        options: ["选项1", "选项2"],
        required: currentField.required,
        defaultValue: [],
      } as MultiSelectFieldConfig;
    } else {
      newField = {
        type: "text",
        name: currentField.name,
        label: currentField.label,
        placeholder: "请输入...",
        required: currentField.required,
        defaultValue: "",
      } as TextFieldConfig;
    }

    const updatedFields = formFields.map((field, i) => (i === index ? newField : field));
    setFormFields(updatedFields);
    updateFormValue("formFields", updatedFields);
  };

  const handleFileConfigChange = (updates: Partial<FileInputConfig>) => {
    const updatedConfig = { ...fileConfig, ...updates };
    setFileConfig(updatedConfig);
    updateFormValue("fileConfig", updatedConfig);
  };

  return (
    <>
      {/* Node Label */}
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={LABEL_CLASS}>节点名称</FormLabel>
            <FormControl>
              <Input {...field} className={`font-medium ${INPUT_CLASS}`} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator className="my-4" />

      {/* Text Input (Toggleable) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className={SECTION_TITLE_CLASS}>
            <Switch checked={enableTextInput} onCheckedChange={handleTextInputToggle} />
            <span>文本输入</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-7">
          关闭后发送按钮将被禁用（除非启用其他输入方式）
        </p>
      </div>

      <Separator className="my-4" />

      {/* File/Image Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className={SECTION_TITLE_CLASS}>
            <Switch checked={enableFileInput} onCheckedChange={handleFileInputToggle} />
            <span>文件/图像输入</span>
          </div>
        </div>

        {enableFileInput && (
          <div className="pl-7 space-y-3 border-l-2 border-gray-200">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">文件类型</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                {FILE_TYPE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`filetype-${option.value.replace(/[.,/*]/g, '-')}`}
                      checked={fileConfig.allowedTypes.includes(option.value)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...fileConfig.allowedTypes, option.value]
                          : fileConfig.allowedTypes.filter((t) => t !== option.value);
                        handleFileConfigChange({ allowedTypes: newTypes });
                      }}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                    <label
                      htmlFor={`filetype-${option.value.replace(/[.,/*]/g, '-')}`}
                      className="text-xs text-gray-700 cursor-pointer flex-1"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">最大体积 (MB)</label>
                <Input
                  type="number"
                  value={fileConfig.maxSizeMB}
                  onChange={(e) =>
                    handleFileConfigChange({ maxSizeMB: parseInt(e.target.value) || 10 })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">最大数量</label>
                <Input
                  type="number"
                  value={fileConfig.maxCount}
                  onChange={(e) =>
                    handleFileConfigChange({ maxCount: parseInt(e.target.value) || 5 })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* Structured Form */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className={SECTION_TITLE_CLASS}>
            <Switch checked={enableStructuredForm} onCheckedChange={handleStructuredFormToggle} />
            <span>结构化表单</span>
          </div>
        </div>

        {enableStructuredForm && (
          <div className="pl-7 space-y-3 border-l-2 border-gray-200">
            {formFields.map((field, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">字段 {index + 1}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteField(index)}
                    className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {/* Field Type Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-gray-500">字段类型</label>
                  <Select
                    value={field.type}
                    onValueChange={(value: "select" | "text" | "multi-select") =>
                      handleFieldTypeChange(index, value)
                    }
                  >
                    <SelectTrigger className={`${INPUT_CLASS} h-8`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select">下拉单选</SelectItem>
                      <SelectItem value="multi-select">下拉多选</SelectItem>
                      <SelectItem value="text">文本字段</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Field Name - HIDDEN for Dropdown Single/Multi Select, shown ? No, hidden for all based on request "Variable Name... don't show on popup" - wait, request says "dropdown single select's variable name... don't show" but maybe text field is okay? 
                   Request: "2.结构化表单的下拉单选的变量名、默认值字段不需要再弹窗上显示；文本字段的占位符、默认值字段不需要再弹窗上显示" 
                   This implies only hiding them for specific types.
                   - Dropdown Single (Select): Hide Name, Default Value.
                   - Text: Hide Placeholder, Default Value.
                   - Multi Select: "Same as Dropdown Single (only multi-select different)" -> Hide Name, Default Value.
                   
                   Wait, if we hide variable name, how does the user know what key to use? 
                   "如果不影响业务，可以将相关代码删除，如果影响业务，都设置一个默认值，然后前端隐藏即可"
                   Since the variable name IS used in the structured output (formData), we MUST generate one or keep the current hidden one.
                   The current code generates `field_${Date.now()}` which is fine.
                */}

                {/* Field Name - Hidden for all as per implicit instruction to simplify? 
                   Actually the prompt specifically says:
                   "下拉单选的变量名...不需要再弹窗上显示"
                   "文本字段的...不需要再弹窗上显示" (Doesn't explicitly say variable name for text field, but usually consistency is better. However, let's stick to strict interpretation first?
                   Wait, "文本字段的占位符、默认值字段不需要再弹窗上显示" -> It does NOT say "Variable Name" for text field.
                   BUT usually users don't want to see variable names if they are auto-generated.
                   Let's hide Variable Name for Select and Multi-Select. For Text, the prompt didn't explicitly forbid it, but it's weird to show it for one and not others.
                   However, let's look at the instruction again:
                   "2.结构化表单的下拉单选的变量名、默认值字段不需要再弹窗上显示；文本字段的占位符、默认值字段不需要再弹窗上显示..."
                   
                   I will hide Variable Name for Select and Multi-Select. I'll keep it for Text for now unless implied otherwise, but actually, if I hide it for Select, I should probably hide it for everything to be consistent?
                   Actually, if I hide it, how can they change it? They can't.
                   
                   Let's stick to: 
                   - Select/Multi-Select: Hide Name, Default Value.
                   - Text: Hide Placeholder, Default Value. (Name is NOT hidden mentioned).
                   
                   Re-reading: "如果影响业务，都设置一个默认值，然后前端隐藏即可"
                   So I will hide them in the UI.
                */}

                {/* Field Label */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-gray-500">显示标签</label>
                  <Input
                    value={field.label}
                    onChange={(e) => handleFieldUpdate(index, { label: e.target.value })}
                    placeholder="字段标签"
                    className={`${INPUT_CLASS} h-8`}
                  />
                </div>

                {/* Type-specific fields */}
                {(field.type === "select" || field.type === "multi-select") && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-500">选项 (逗号分隔)</label>
                    <Input
                      value={(field as SelectFieldConfig | MultiSelectFieldConfig).options.join(", ")}
                      onChange={(e) =>
                        handleFieldUpdate(index, {
                          options: e.target.value.split(",").map((s) => s.trim()),
                        })
                      }
                      placeholder="选项1, 选项2, 选项3"
                      className={`${INPUT_CLASS} h-8`}
                    />
                  </div>
                )}

                {/* 
                   Hidden Fields Logic:
                   - Select/Multi-Select: Name (Hidden), Default Value (Hidden)
                   - Text: Placeholder (Hidden), Default Value (Hidden)
                   
                   So effectively:
                   - Placeholder is only for Text, and it's hidden.
                   - Default Value is for all, and it's hidden for all.
                   
                   So I just need to REMOVE Placeholder and Default Value sections entirely from the UI.
                */}

                {/* Required Checkbox */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(checked) => handleFieldUpdate(index, { required: checked })}
                  />
                  <label className="text-xs font-medium text-gray-600">必填</label>
                </div>
              </div>
            ))}

            {/* Add Field Button - CRITICAL: type="button" to prevent form submission */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddField}
              className="w-full border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            >
              <Plus className="w-3 h-3 mr-1" />
              添加字段
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
