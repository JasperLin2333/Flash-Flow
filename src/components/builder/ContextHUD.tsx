"use client";
import React, { useEffect } from "react";
import { useFlowStore } from "@/store/flowStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import type { NodeKind } from "@/types/flow";
import { LLMNodeForm } from "./node-forms/LLMNodeForm";
import { InputNodeForm } from "./node-forms/InputNodeForm";
import { RAGNodeForm } from "./node-forms/RAGNodeForm";
import { OutputNodeForm } from "./node-forms/OutputNodeForm";
import { ToolNodeForm } from "./node-forms/ToolNodeForm";
import { BranchNodeForm } from "./node-forms/BranchNodeForm";

// Schema
const formSchema = z.object({
    label: z.string().min(1, "Label is required"),
    model: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    systemPrompt: z.string().optional(),
    text: z.string().optional(),
    toolType: z.string().optional(),
    inputs: z.record(z.string(), z.any()).optional(),
    // LLM node specific fields
    enableMemory: z.boolean().optional(),
    memoryMaxTurns: z.number().min(1).max(20).optional(),
    // Input node specific fields
    enableTextInput: z.boolean().optional(),
    enableFileInput: z.boolean().optional(),
    enableStructuredForm: z.boolean().optional(),
    fileConfig: z.object({
        allowedTypes: z.array(z.string()),
        maxSizeMB: z.number(),
        maxCount: z.number(),
    }).optional(),
    formFields: z.array(z.any()).optional(),
    // Branch node specific fields
    condition: z.string().optional(),
});

// Constants
const DEFAULT_MODEL = "qwen-flash";
const DEFAULT_TEMPERATURE = 0.7;
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

// Sub-components

function ExecutionOutput({ executionOutput }: { executionOutput: any }) {
    if (!executionOutput) return null;

    return (
        <div className="mt-8 pt-5 border-t border-gray-100">
            <h4 className={`${LABEL_CLASS} mb-3`}>最近一次执行输出</h4>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-64 overflow-auto">
                <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all">{JSON.stringify(executionOutput, null, 2)}</pre>
            </div>
        </div>
    );
}

export default function ContextHUD() {
    const { selectedNodeId, nodes, updateNodeData, setSelectedNode, flowContext } = useFlowStore();
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            label: "",
            model: DEFAULT_MODEL,
            temperature: DEFAULT_TEMPERATURE,
            systemPrompt: "",
            text: "",
            enableMemory: false,
            memoryMaxTurns: 10,
        },
    });

    useEffect(() => {
        if (selectedNode) {
            const type = selectedNode.type as NodeKind;
            const d = selectedNode.data || {};
            const has = (k: string) => k in d;
            form.reset({
                label: String(d.label || ""),
                model: type === "llm" && has("model") ? String((d as { model?: string }).model || DEFAULT_MODEL) : DEFAULT_MODEL,
                temperature: type === "llm" && has("temperature") ? Number((d as { temperature?: number }).temperature ?? DEFAULT_TEMPERATURE) : DEFAULT_TEMPERATURE,
                systemPrompt: type === "llm" && has("systemPrompt") ? String((d as { systemPrompt?: string }).systemPrompt || "") : "",
                // LLM Memory fields
                enableMemory: type === "llm" && has("enableMemory") ? (d as any).enableMemory : false,
                memoryMaxTurns: type === "llm" && has("memoryMaxTurns") ? (d as any).memoryMaxTurns : 10,

                text: (type === "input" || type === "output") && has("text") ? String((d as { text?: string }).text || "") : "",
                // Input node specific fields
                enableTextInput: type === "input" && has("enableTextInput") ? (d as any).enableTextInput : true,
                enableFileInput: type === "input" && has("enableFileInput") ? (d as any).enableFileInput : false,
                enableStructuredForm: type === "input" && has("enableStructuredForm") ? (d as any).enableStructuredForm : false,
                fileConfig: type === "input" && has("fileConfig") ? (d as any).fileConfig : undefined,
                formFields: type === "input" && has("formFields") ? (d as any).formFields : undefined,
                toolType: type === "tool" && has("toolType") ? String((d as { toolType?: string }).toolType || "web_search") : "web_search",
                inputs: type === "tool" && has("inputs") ? (d as { inputs?: Record<string, unknown> }).inputs || {} : {},
                // Branch node specific fields
                condition: type === "branch" && has("condition") ? String((d as any).condition || "") : "",
            });
        }
    }, [selectedNode, form]);

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        if (selectedNodeId) {
            updateNodeData(selectedNodeId, values);
        }
    };

    // Calculate derived data conditionally usually
    const type = selectedNode?.type as NodeKind | undefined;
    const executionOutput = selectedNode ? flowContext[selectedNode.id] : undefined;

    return (
        <AnimatePresence mode="wait">
            {selectedNode && type && (
                <motion.div
                    key="context-hud-panel"
                    initial={{ x: 320, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 320, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="fixed top-6 right-6 w-80 max-h-[calc(100vh-48px)] bg-white border border-gray-200 shadow-xl rounded-2xl flex flex-col z-20 overflow-hidden"
                >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            {type} 节点
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            onClick={() => setSelectedNode(null)}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {/* Use key here to ensure content refreshes when switching between nodes of same type if needed, 
                            though form.reset handles values. Adding key helps with scroll reset. */}
                        <div className="p-5 space-y-6" key={selectedNode.id}>
                            <Form {...form}>
                                <form onBlur={form.handleSubmit(onSubmit)} className="space-y-4">
                                    {type === "llm" && <LLMNodeForm form={form} />}
                                    {type === "input" && <InputNodeForm form={form} selectedNodeId={selectedNodeId || undefined} updateNodeData={updateNodeData} />}
                                    {type === "rag" && <RAGNodeForm form={form} selectedNodeId={selectedNodeId} updateNodeData={updateNodeData} selectedNode={selectedNode} />}
                                    {type === "output" && <OutputNodeForm form={form} />}
                                    {type === "tool" && <ToolNodeForm form={form} />}
                                    {type === "branch" && <BranchNodeForm form={form} />}
                                </form>
                            </Form>

                            <ExecutionOutput executionOutput={executionOutput} />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
