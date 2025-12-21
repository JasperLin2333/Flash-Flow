"use client";
import React, { useEffect, useRef, useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { NodeKind } from "@/types/flow";

// Node form components
import { LLMNodeForm } from "../node-forms/LLMNodeForm";
import { InputNodeForm } from "../node-forms/InputNodeForm";
import { RAGNodeForm } from "../node-forms/RAGNodeForm";
import { OutputNodeForm } from "../node-forms/OutputNodeForm";
import { ToolNodeForm } from "../node-forms/ToolNodeForm";
import { BranchNodeForm } from "../node-forms/BranchNodeForm";

// Local components and utilities
import { NodeIOSection } from "./NodeIOSection";
import { ExecutionOutput } from "./ExecutionOutput";
import { ResizeHandle } from "./ResizeHandle";
import {
    formSchema,
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
    type FormValues,
} from "./constants";

// Panel width constants
const PANEL_DEFAULT_WIDTH = 320;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 800;
const PANEL_RIGHT_OFFSET = 24; // 6 * 4 = 24px (right-6 in tailwind)

export default function ContextHUD() {
    const { selectedNodeId, nodes, edges, updateNodeData, setSelectedNode, flowContext } = useFlowStore();
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);

    // Panel width state for resizable functionality
    const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            label: "",
            model: DEFAULT_MODEL,
            temperature: DEFAULT_TEMPERATURE,
            systemPrompt: "",
            text: "",
            enableMemory: false,
            memoryMaxTurns: 10,
            greeting: "",  // 招呼语默认值
        },
    });

    // 当选中节点 ID 变化时，从 store 中获取最新的节点数据并重置表单
    // 注意：只依赖 selectedNodeId，避免 nodes 数组变化导致不必要的重置
    // 在 effect 内部通过 getState() 获取最新的节点数据
    useEffect(() => {
        if (!selectedNodeId) return;

        // 使用 getState 获取最新状态，避免将 nodes 添加到依赖数组
        const { nodes: currentNodes } = useFlowStore.getState();
        const node = currentNodes.find((n) => n.id === selectedNodeId);
        if (!node) return;

        const type = node.type as NodeKind;
        const d = node.data || {};
        const has = (k: string) => k in d;
        form.reset({
            label: String(d.label || ""),
            model: type === "llm" && has("model") ? String((d as { model?: string }).model || DEFAULT_MODEL) : DEFAULT_MODEL,
            temperature: type === "llm" && has("temperature") ? Number((d as { temperature?: number }).temperature ?? DEFAULT_TEMPERATURE) : DEFAULT_TEMPERATURE,
            systemPrompt: type === "llm" && has("systemPrompt") ? String((d as { systemPrompt?: string }).systemPrompt || "") : "",
            // LLM Memory fields
            enableMemory: type === "llm" && has("enableMemory") ? (d as Record<string, unknown>).enableMemory as boolean : false,
            memoryMaxTurns: type === "llm" && has("memoryMaxTurns") ? (d as Record<string, unknown>).memoryMaxTurns as number : 10,

            text: (type === "input" || type === "output") && has("text") ? String((d as { text?: string }).text || "") : "",
            // Input node specific fields
            enableTextInput: type === "input" && has("enableTextInput") ? (d as Record<string, unknown>).enableTextInput as boolean : true,
            enableFileInput: type === "input" && has("enableFileInput") ? (d as Record<string, unknown>).enableFileInput as boolean : false,
            enableStructuredForm: type === "input" && has("enableStructuredForm") ? (d as Record<string, unknown>).enableStructuredForm as boolean : false,
            fileConfig: type === "input" && has("fileConfig") ? (d as Record<string, unknown>).fileConfig as { allowedTypes: string[]; maxSizeMB: number; maxCount: number } : undefined,
            formFields: type === "input" && has("formFields") ? (d as Record<string, unknown>).formFields as unknown[] : undefined,
            greeting: type === "input" && has("greeting") ? String((d as Record<string, unknown>).greeting || "") : "",
            toolType: type === "tool" && has("toolType") ? String((d as { toolType?: string }).toolType || "web_search") : "web_search",
            inputs: type === "tool" && has("inputs") ? (d as { inputs?: Record<string, unknown> }).inputs || {} : {},
            // Branch node specific fields
            condition: type === "branch" && has("condition") ? String((d as Record<string, unknown>).condition || "") : "",
        });
    }, [selectedNodeId, form]);

    // 使用 ref 来跟踪是否正在初始化表单（避免重复更新）
    const isInitializing = useRef(false);

    // 监听表单值变化，立即更新节点数据
    useEffect(() => {
        const subscription = form.watch((values, { name }) => {
            // 跳过初始化阶段的更新
            if (isInitializing.current) return;
            // 跳过无效状态
            if (!selectedNodeId || !name) return;

            // 立即更新节点数据
            updateNodeData(selectedNodeId, values as FormValues);
        });

        return () => subscription.unsubscribe();
    }, [form, selectedNodeId, updateNodeData]);

    // 当选中的节点变化时，标记正在初始化
    useEffect(() => {
        if (selectedNode) {
            isInitializing.current = true;
            // 使用 setTimeout 确保 form.reset 完成后再取消初始化状态
            const timer = setTimeout(() => {
                isInitializing.current = false;
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [selectedNode?.id]);

    // 保留 onSubmit 供需要时使用（例如按钮提交）
    const onSubmit = (values: FormValues) => {
        if (selectedNodeId) {
            updateNodeData(selectedNodeId, values);
        }
    };

    // Calculate derived data conditionally usually
    const type = selectedNode?.type as NodeKind | undefined;
    const executionOutput = selectedNode ? flowContext[selectedNode.id] : undefined;
    const nodeLabel = selectedNode?.data?.label as string | undefined;

    return (
        <AnimatePresence mode="wait">
            {selectedNode && type && (
                <motion.div
                    key="context-hud-panel"
                    initial={{ x: panelWidth, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: panelWidth, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="fixed top-6 right-6 max-h-[calc(100vh-48px)] bg-white border border-gray-200 shadow-xl rounded-2xl flex flex-col z-20 overflow-hidden"
                    style={{ width: panelWidth }}
                >
                    {/* Resize Handle - Left edge drag area */}
                    <ResizeHandle
                        width={panelWidth}
                        minWidth={PANEL_MIN_WIDTH}
                        maxWidth={PANEL_MAX_WIDTH}
                        rightOffset={PANEL_RIGHT_OFFSET}
                        onWidthChange={setPanelWidth}
                    />

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
                                <form className="space-y-4">
                                    {type === "llm" && <LLMNodeForm form={form} />}
                                    {type === "input" && <InputNodeForm form={form} selectedNodeId={selectedNodeId || undefined} updateNodeData={updateNodeData} />}
                                    {type === "rag" && <RAGNodeForm form={form} selectedNodeId={selectedNodeId} updateNodeData={updateNodeData} selectedNode={selectedNode} />}
                                    {type === "output" && <OutputNodeForm form={form} />}
                                    {type === "tool" && <ToolNodeForm form={form} />}
                                    {type === "branch" && <BranchNodeForm form={form} />}
                                </form>
                            </Form>

                            {/* 节点输入/输出参数显示 */}
                            <NodeIOSection
                                nodeId={selectedNode.id}
                                nodeType={type}
                                nodeLabel={nodeLabel}
                                nodeData={selectedNode.data as Record<string, unknown>}
                                nodes={nodes}
                                edges={edges}
                                flowContext={flowContext}
                                customOutputs={(selectedNode.data as Record<string, unknown>)?.customOutputs as { name: string; value: string }[] | undefined}
                                onUpdateCustomOutputs={(outputs) => {
                                    if (selectedNodeId) {
                                        updateNodeData(selectedNodeId, { customOutputs: outputs });
                                    }
                                }}
                                onUpdateToolInputs={(inputs) => {
                                    if (selectedNodeId) {
                                        updateNodeData(selectedNodeId, { inputs });
                                    }
                                }}
                                onUpdateInputMappings={(mappings) => {
                                    if (selectedNodeId) {
                                        updateNodeData(selectedNodeId, { inputMappings: mappings });
                                    }
                                }}
                            />

                            <ExecutionOutput executionOutput={executionOutput} />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Re-export types for convenience
export * from "./types";
