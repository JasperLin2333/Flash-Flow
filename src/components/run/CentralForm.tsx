import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NodeForm } from "./NodeForm";
import type { InputNodeData } from "@/types/flow";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

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

    // Configs
    const formFields = inputNodeData.formFields || [];
    const greeting = inputNodeData.greeting || "请填写以下信息以开始对话";
    const enableTextInput = inputNodeData.enableTextInput !== false; // Default true

    // Initialize form data
    useEffect(() => {
        const initialFormData: Record<string, unknown> = inputNodeData.formData || {};
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

    const handleStart = () => {
        if (validateForm()) {
            onSend({
                text: text.trim() || "开始对话", // Use user text if available, fallback to default
                formData: formData
            });
        }
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
                                补充说明 (可选)
                            </label>
                            <Textarea
                                placeholder="输入您的问题或更多背景信息..."
                                className="min-h-[100px] resize-none border-gray-200 focus:border-black focus:ring-black/5"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
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
