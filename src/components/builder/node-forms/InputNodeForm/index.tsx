"use client";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TrackedSwitch } from "@/components/ui/tracked-switch";
import type { FileInputConfig } from "@/types/flow";
import {
    LABEL_CLASS,
    INPUT_CLASS,
    DEFAULT_FILE_CONFIG,
    createNewTextField,
    createFieldOfType,
    type InputNodeFormProps,
} from "./constants";
import { NODE_FORM_STYLES, CapabilityItem } from "../shared";
import { FileInputSection } from "./FileInputSection";
import { StructuredFormSection } from "./StructuredFormSection";
import { MessageSquare, UploadCloud, LayoutTemplate } from "lucide-react";

/**
 * InputNodeForm - Input 节点配置表单
 */
export function InputNodeForm({ form }: InputNodeFormProps) {
    const watchedEnableTextInput = useWatch({ control: form.control, name: "enableTextInput" });
    const watchedTextRequired = useWatch({ control: form.control, name: "textRequired" });
    const watchedEnableFileInput = useWatch({ control: form.control, name: "enableFileInput" });
    const watchedEnableStructuredForm = useWatch({ control: form.control, name: "enableStructuredForm" });
    const watchedFileRequired = useWatch({ control: form.control, name: "fileRequired" });
    const watchedFormFields = useWatch({ control: form.control, name: "formFields" });
    const watchedFileConfig = useWatch({ control: form.control, name: "fileConfig" });

    const enableFileInput = watchedEnableFileInput === true;
    const enableTextInput = watchedEnableTextInput !== false;
    const textRequired = enableTextInput && watchedTextRequired === true;
    const enableStructuredForm = watchedEnableStructuredForm === true;
    const fileRequired = enableFileInput && watchedFileRequired === true;

    const formFields = useMemo(() =>
        Array.isArray(watchedFormFields) ? watchedFormFields : [],
        [watchedFormFields]
    );
    const fileConfig = useMemo(() =>
        watchedFileConfig || DEFAULT_FILE_CONFIG,
        [watchedFileConfig]
    );

    const updateFormValue = (key: string, value: any) => {
        form.setValue(key, value, { shouldDirty: true });
    };

    const handleTextInputToggle = (checked: boolean) => {
        updateFormValue("enableTextInput", checked);
        if (!checked) {
            updateFormValue("textRequired", false);
        }
    };

    const handleTextRequiredToggle = (checked: boolean) => {
        updateFormValue("textRequired", checked);
    };

    const handleFileInputToggle = (checked: boolean) => {
        updateFormValue("enableFileInput", checked);
        if (checked && !form.getValues("fileConfig")) {
            updateFormValue("fileConfig", DEFAULT_FILE_CONFIG);
        }
        if (!checked) {
            updateFormValue("fileRequired", false);
        }
    };

    const handleStructuredFormToggle = (checked: boolean) => {
        updateFormValue("enableStructuredForm", checked);
        if (checked && formFields.length === 0) {
            updateFormValue("formFields", [createNewTextField()]);
        }
    };

    const handleFileRequiredToggle = (checked: boolean) => {
        updateFormValue("fileRequired", checked);
    };

    const handleFileConfigChange = (updates: Partial<FileInputConfig>) => {
        const updatedConfig = { ...fileConfig, ...updates };
        updateFormValue("fileConfig", updatedConfig);
    };

    const handleAddField = () => {
        const newField = createNewTextField();
        const updatedFields = [...formFields, newField];
        updateFormValue("formFields", updatedFields);
    };

    const handleDeleteField = (index: number) => {
        const updatedFields = formFields.filter((_, i) => i !== index);
        updateFormValue("formFields", updatedFields);
    };

    const handleFieldUpdate = (index: number, updates: any) => {
        const updatedFields = formFields.map((field, i) => {
            if (i !== index) return field;
            return { ...field, ...updates };
        });
        updateFormValue("formFields", updatedFields);
    };

    const handleFieldTypeChange = (index: number, newType: "select" | "text" | "multi-select") => {
        const currentField = formFields[index];
        const newField = createFieldOfType(currentField, newType);
        const updatedFields = formFields.map((field, i) => (i === index ? newField : field));
        updateFormValue("formFields", updatedFields);
    };

    return (
        <div className="space-y-4 px-1 pb-4">
            {/* 1. 基础信息 & 招呼语 - 紧凑布局 */}
            <div className="grid gap-4">
                <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={LABEL_CLASS}>节点名称</FormLabel>
                            <FormControl>
                                <Input {...field} className={INPUT_CLASS} placeholder="例如：用户输入" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="greeting"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={LABEL_CLASS}>欢迎语</FormLabel>
                            <FormControl>
                                <textarea
                                    {...field}
                                    placeholder="例如：你好！我是你的 AI 助手，有什么可以帮你？"
                                    rows={3}
                                    className={NODE_FORM_STYLES.TEXTAREA}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className={NODE_FORM_STYLES.SECTION_DIVIDER} />

            {/* 2. 输入能力配置 (Unified Capabilities List) */}
            <div className="space-y-2">
                <div className={NODE_FORM_STYLES.SECTION_TITLE}>输入能力</div>
                
                <div className={`${NODE_FORM_STYLES.CARD} p-0 overflow-hidden divide-y divide-gray-100`}>
                    {/* Item 1: Text Input */}
                    <CapabilityItem
                        icon={<MessageSquare className="w-4 h-4" />}
                        iconColorClass="bg-blue-50 text-blue-600"
                        title="文本对话"
                        description="允许用户发送文本消息"
                        isExpanded={enableTextInput}
                        rightElement={
                            <TrackedSwitch
                                trackingName="enableTextInput"
                                nodeType="input"
                                checked={enableTextInput}
                                onCheckedChange={handleTextInputToggle}
                            />
                        }
                    >
                        <div className="pt-1 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200">
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-900">文本必填</div>
                                    <div className="text-[11px] text-gray-500">发送前必须填写文本内容</div>
                                </div>
                                <TrackedSwitch
                                    trackingName="textRequired"
                                    nodeType="input"
                                    checked={textRequired}
                                    onCheckedChange={handleTextRequiredToggle}
                                />
                            </div>
                        </div>
                    </CapabilityItem>

                    {/* Item 2: File Upload */}
                    <CapabilityItem
                        icon={<UploadCloud className="w-4 h-4" />}
                        iconColorClass="bg-orange-50 text-orange-600"
                        title="文件上传"
                        description="允许用户上传图片、文档等文件"
                        isExpanded={enableFileInput}
                        rightElement={
                            <TrackedSwitch
                                trackingName="enableFileInput"
                                nodeType="input"
                                checked={enableFileInput}
                                onCheckedChange={handleFileInputToggle}
                            />
                        }
                    >
                        <div className="pt-1 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200">
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-900">文件必填</div>
                                    <div className="text-[11px] text-gray-500">发送前至少上传 1 个文件</div>
                                </div>
                                <TrackedSwitch
                                    trackingName="fileRequired"
                                    nodeType="input"
                                    checked={fileRequired}
                                    onCheckedChange={handleFileRequiredToggle}
                                />
                            </div>
                        <FileInputSection
                            enabled={true}
                            onToggle={() => {}} // No-op
                            fileConfig={fileConfig}
                            onConfigChange={handleFileConfigChange}
                            isHeaderHidden={true}
                        />
                        </div>
                    </CapabilityItem>

                    {/* Item 3: Structured Form */}
                    <CapabilityItem
                        icon={<LayoutTemplate className="w-4 h-4" />}
                        iconColorClass="bg-purple-50 text-purple-600"
                        title="结构化表单"
                        description="用表单字段引导用户按格式填写"
                        isExpanded={enableStructuredForm}
                        rightElement={
                            <TrackedSwitch
                                trackingName="enableStructuredForm"
                                nodeType="input"
                                checked={enableStructuredForm}
                                onCheckedChange={handleStructuredFormToggle}
                            />
                        }
                    >
                        <StructuredFormSection
                            enabled={true}
                            onToggle={() => {}} // No-op
                            formFields={formFields}
                            onAddField={handleAddField}
                            onDeleteField={handleDeleteField}
                            onFieldUpdate={handleFieldUpdate}
                            onFieldTypeChange={handleFieldTypeChange}
                            isHeaderHidden={true}
                        />
                    </CapabilityItem>
                </div>
            </div>
        </div>
    );
}
