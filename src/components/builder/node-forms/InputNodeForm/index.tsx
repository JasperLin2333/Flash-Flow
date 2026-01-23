"use client";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TrackedSwitch } from "@/components/ui/tracked-switch";
import type { FormFieldConfig, FileInputConfig } from "@/types/flow";
import {
    LABEL_CLASS,
    INPUT_CLASS,
    SECTION_TITLE_CLASS,
    DEFAULT_FILE_CONFIG,
    createNewTextField,
    createFieldOfType,
    type InputNodeFormProps,
} from "./constants";
import { FileInputSection } from "./FileInputSection";
import { StructuredFormSection } from "./StructuredFormSection";
import { FormSeparator } from "../shared";

/**
 * InputNodeForm - Input 节点配置表单
 * 支持文本输入、文件上传、结构化表单三种输入方式
 * 
 * 使用 form.watch 替代 useState 来避免双重状态管理
 */
export function InputNodeForm({ form, selectedNodeId, updateNodeData }: InputNodeFormProps) {
    // 使用 useWatch 获取状态（会订阅变化并触发重渲染）
    const watchedEnableTextInput = useWatch({ control: form.control, name: "enableTextInput" });
    const watchedEnableFileInput = useWatch({ control: form.control, name: "enableFileInput" });
    const watchedEnableStructuredForm = useWatch({ control: form.control, name: "enableStructuredForm" });
    const watchedFormFields = useWatch({ control: form.control, name: "formFields" });
    const watchedFileConfig = useWatch({ control: form.control, name: "fileConfig" });

    // 计算派生状态
    const enableTextInput = watchedEnableTextInput !== false; // Default true
    const enableFileInput = watchedEnableFileInput === true;
    const enableStructuredForm = watchedEnableStructuredForm === true;

    // formFields 和 fileConfig 需要 memoize 以避免不必要的重渲染
    const formFields = useMemo(() =>
        Array.isArray(watchedFormFields) ? watchedFormFields : [],
        [watchedFormFields]
    );
    const fileConfig = useMemo(() =>
        watchedFileConfig || DEFAULT_FILE_CONFIG,
        [watchedFileConfig]
    );

    // Update form values and sync to store
    // 注意：需要 shouldDirty: true 来触发 form.watch 的订阅更新
    const updateFormValue = (key: string, value: any) => {
        form.setValue(key, value, { shouldDirty: true });
        if (selectedNodeId && updateNodeData) {
            updateNodeData(selectedNodeId, { [key]: value });
        }
    };

    // ============ Toggle Handlers ============
    const handleTextInputToggle = (checked: boolean) => {
        updateFormValue("enableTextInput", checked);
    };

    const handleFileInputToggle = (checked: boolean) => {
        updateFormValue("enableFileInput", checked);
        if (checked && !form.getValues("fileConfig")) {
            updateFormValue("fileConfig", DEFAULT_FILE_CONFIG);
        }
    };

    const handleStructuredFormToggle = (checked: boolean) => {
        updateFormValue("enableStructuredForm", checked);
        if (checked && formFields.length === 0) {
            updateFormValue("formFields", []);
        }
    };

    // ============ File Config Handlers ============
    const handleFileConfigChange = (updates: Partial<FileInputConfig>) => {
        const updatedConfig = { ...fileConfig, ...updates };
        updateFormValue("fileConfig", updatedConfig);
    };

    // ============ Form Field Handlers ============
    const handleAddField = () => {
        const newField = createNewTextField();
        const updatedFields = [...formFields, newField];
        updateFormValue("formFields", updatedFields);
    };

    const handleDeleteField = (index: number) => {
        const updatedFields = formFields.filter((_, i) => i !== index);
        updateFormValue("formFields", updatedFields);
    };

    const handleFieldUpdate = (index: number, updates: Partial<FormFieldConfig>) => {
        const updatedFields = formFields.map((field, i) => {
            if (i !== index) return field;
            return { ...field, ...updates } as FormFieldConfig;
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

            {/* Input Capabilities Section */}
            <div className="space-y-2">
                <div className={`${LABEL_CLASS} px-1`}>输入方式</div>
                <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-3">
                    {/* Text Input Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-700">文本输入</span>
                            <span className="text-[10px] text-gray-500">允许输入文本内容</span>
                        </div>
                        <TrackedSwitch
                            trackingName="enableTextInput"
                            nodeType="input"
                            checked={enableTextInput}
                            onCheckedChange={handleTextInputToggle}
                        />
                    </div>

                    {/* File Input Toggle */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-700">文件 / 图像上传</span>
                            <span className="text-[10px] text-gray-500">允许各类文件上传</span>
                        </div>
                        <TrackedSwitch
                            trackingName="enableFileInput"
                            nodeType="input"
                            checked={enableFileInput}
                            onCheckedChange={handleFileInputToggle}
                        />
                    </div>

                    {/* Structured Form Toggle */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-700">快捷表单</span>
                            <span className="text-[10px] text-gray-500">通过表单快速描述需求，让对话更有条理</span>
                        </div>
                        <TrackedSwitch
                            trackingName="enableStructuredForm"
                            nodeType="input"
                            checked={enableStructuredForm}
                            onCheckedChange={handleStructuredFormToggle}
                        />
                    </div>
                </div>
            </div>

            {/* Conditional Configuration Sections */}
            {(enableFileInput || enableStructuredForm) && (
                <div className="space-y-4">
                    {/* File/Image Configuration */}
                    {enableFileInput && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className={`${LABEL_CLASS} px-1`}>文件上传设置</div>
                            <FileInputSection
                                enabled={true}
                                onToggle={() => { }} // Toggle handled by parent
                                fileConfig={fileConfig}
                                onConfigChange={handleFileConfigChange}
                                isHeaderHidden={true}
                            />
                        </div>
                    )}

                    {/* Structured Form Configuration */}
                    {enableStructuredForm && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className={`${LABEL_CLASS} px-1`}>表单设置</div>
                            <StructuredFormSection
                                enabled={true}
                                onToggle={() => { }} // Toggle handled by parent
                                formFields={formFields}
                                onAddField={handleAddField}
                                onDeleteField={handleDeleteField}
                                onFieldUpdate={handleFieldUpdate}
                                onFieldTypeChange={handleFieldTypeChange}
                                isHeaderHidden={true}
                            />
                        </div>
                    )}
                </div>
            )}

            <FormSeparator />

            {/* 招呼语配置 */}
            <FormField
                control={form.control}
                name="greeting"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={LABEL_CLASS}>招呼语</FormLabel>
                        <FormControl>
                            <textarea
                                {...field}
                                placeholder="引导用户如何使用该助手..."
                                rows={3}
                                className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
