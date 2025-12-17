"use client";
import { useState, useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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

/**
 * InputNodeForm - Input 节点配置表单
 * 支持文本输入、文件上传、结构化表单三种输入方式
 */
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
        form.getValues("fileConfig") || DEFAULT_FILE_CONFIG
    );

    // Update form values when state changes
    const updateFormValue = (key: string, value: any) => {
        form.setValue(key, value);
        if (selectedNodeId && updateNodeData) {
            updateNodeData(selectedNodeId, { [key]: value });
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

    // ============ Toggle Handlers ============
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
            updateFormValue("formFields", []);
        } else if (!checked) {
            // 关闭结构化表单时，清空字段配置和表单数据
            setFormFields([]);
            updateFormValue("formFields", []);
            updateFormValue("formData", undefined);
        }
    };

    // ============ File Config Handlers ============
    const handleFileConfigChange = (updates: Partial<FileInputConfig>) => {
        const updatedConfig = { ...fileConfig, ...updates };
        setFileConfig(updatedConfig);
        updateFormValue("fileConfig", updatedConfig);
    };

    // ============ Form Field Handlers ============
    const handleAddField = () => {
        const newField = createNewTextField();
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
        const newField = createFieldOfType(currentField, newType);
        const updatedFields = formFields.map((field, i) => (i === index ? newField : field));
        setFormFields(updatedFields);
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
                    关闭后文本发送将被禁用
                </p>
            </div>

            <Separator className="my-4" />

            {/* File/Image Input */}
            <FileInputSection
                enabled={enableFileInput}
                onToggle={handleFileInputToggle}
                fileConfig={fileConfig}
                onConfigChange={handleFileConfigChange}
            />

            <Separator className="my-4" />

            {/* Structured Form */}
            <StructuredFormSection
                enabled={enableStructuredForm}
                onToggle={handleStructuredFormToggle}
                formFields={formFields}
                onAddField={handleAddField}
                onDeleteField={handleDeleteField}
                onFieldUpdate={handleFieldUpdate}
                onFieldTypeChange={handleFieldTypeChange}
            />
        </>
    );
}
