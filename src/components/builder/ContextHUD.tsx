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
import { HTTPNodeForm } from "./node-forms/HTTPNodeForm";
import { RAGNodeForm } from "./node-forms/RAGNodeForm";
import { OutputNodeForm } from "./node-forms/OutputNodeForm";

// Schema
const formSchema = z.object({
    label: z.string().min(1, "Label is required"),
    model: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    systemPrompt: z.string().optional(),
    text: z.string().optional(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
    url: z.string().url().optional().or(z.literal("")),
});

// Constants
const DEFAULT_MODEL = "doubao-seed-1-6-flash-250828";
const DEFAULT_TEMPERATURE = 0.7;
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";
const HUD_ANIMATION = {
    initial: { x: 320, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 320, opacity: 0 },
};

// Sub-components

function ExecutionOutput({ executionOutput }: { executionOutput: any }) {
    if (!executionOutput) return null;

    return (
        <div className="mt-8 pt-5 border-t border-gray-100">
            <h4 className={`${LABEL_CLASS} mb-3`}>最近一次执行输出</h4>
            <div className="bg-gray-50 rounded-xl p-3 overflow-auto border border-gray-200 max-h-48">
                <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-words">{JSON.stringify(executionOutput, null, 2)}</pre>
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
            method: "GET",
            url: "",
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
                text: (type === "input" || type === "output") && has("text") ? String((d as { text?: string }).text || "") : "",
                method: type === "http" && has("method") ? ((d as { method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" }).method || "GET") : "GET",
                url: type === "http" && has("url") ? String((d as { url?: string }).url || "") : "",
            });
        }
    }, [selectedNode, form]);

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        if (selectedNodeId) {
            updateNodeData(selectedNodeId, values);
        }
    };

    if (!selectedNode) return null;

    const type = selectedNode.type as NodeKind;
    const executionOutput = flowContext[selectedNode.id];

    return (
        <AnimatePresence>
            {selectedNode && (
                <motion.div
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

                    <ScrollArea className="flex-1">
                        <div className="p-5 space-y-6">
                            <Form {...form}>
                                <form onBlur={form.handleSubmit(onSubmit)} className="space-y-4">
                                    {type === "llm" && <LLMNodeForm form={form} />}
                                    {type === "input" && <InputNodeForm form={form} />}
                                    {type === "http" && <HTTPNodeForm form={form} />}
                                    {type === "rag" && <RAGNodeForm form={form} selectedNodeId={selectedNodeId} updateNodeData={updateNodeData} selectedNode={selectedNode} />}
                                    {type === "output" && <OutputNodeForm form={form} />}
                                </form>
                            </Form>

                            <ExecutionOutput executionOutput={executionOutput} />
                        </div>
                    </ScrollArea>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
