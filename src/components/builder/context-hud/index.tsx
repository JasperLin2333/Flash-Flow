"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { X, Play, Loader2, CheckCircle2, AlertCircle, MessageSquare, BrainCircuit, Database, Send, Hammer, GitFork, Image as ImageIcon } from "lucide-react";
import type { NodeKind, ExecutionStatus } from "@/types/flow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { handleNodeTest } from "@/store/utils/nodeTestUtils";
import { track } from "@/lib/trackingService";
import { DEFAULT_TOOL_TYPE } from "@/lib/tools/registry";

// Node form components
import { LLMNodeForm } from "../node-forms/LLMNodeForm";
import { InputNodeForm } from "../node-forms/InputNodeForm";
import { RAGNodeForm } from "../node-forms/RAGNodeForm";
import { OutputNodeForm } from "../node-forms/OutputNodeForm";
import { ToolNodeForm } from "../node-forms/ToolNodeForm";
import { BranchNodeForm } from "../node-forms/BranchNodeForm";
import { ImageGenNodeForm } from "../node-forms/ImageGenNodeForm";

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
const PANEL_DEFAULT_WIDTH = 400; // Wider default for better readability
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 800;
const PANEL_RIGHT_OFFSET = 24; // 6 * 4 = 24px (right-6 in tailwind)

const NODE_ICONS: Record<NodeKind, React.ReactNode> = {
    input: <MessageSquare className="w-4 h-4" />,
    llm: <BrainCircuit className="w-4 h-4" />,
    rag: <Database className="w-4 h-4" />,
    output: <Send className="w-4 h-4" />,
    tool: <Hammer className="w-4 h-4" />,
    branch: <GitFork className="w-4 h-4" />,
    imagegen: <ImageIcon className="w-4 h-4" />,
};

const NODE_COLORS: Record<NodeKind, string> = {
    input: "bg-blue-50 text-blue-600 border-blue-100",
    llm: "bg-indigo-50 text-indigo-600 border-indigo-100",
    rag: "bg-purple-50 text-purple-600 border-purple-100",
    output: "bg-green-50 text-green-600 border-green-100",
    tool: "bg-amber-50 text-amber-600 border-amber-100",
    branch: "bg-slate-50 text-slate-600 border-slate-100",
    imagegen: "bg-pink-50 text-pink-600 border-pink-100",
};

const STATUS_ICON: Record<ExecutionStatus, React.ReactNode> = {
    idle: <div className="w-2 h-2 rounded-full bg-gray-300 ring-2 ring-gray-100" />,
    running: <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
    error: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
};

export default function ContextHUD() {
    const {
        selectedNodeId,
        nodes,
        edges,
        updateNodeData,
        setSelectedNode,
        flowContext,
        runNode,
        runningNodeIds,
        openDialog,      // Unified Dialog Action
        openInputPrompt, // Keep for standard input test
    } = useFlowStore();
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    const selectedNodeType = selectedNode?.type;

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
            condition: "",  // Branch 节点条件默认值
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

        // Model field needs different defaults for LLM vs ImageGen
        const getModelDefault = () => {
            if (type === "llm") {
                return has("model") ? String((d as { model?: string }).model || DEFAULT_MODEL) : DEFAULT_MODEL;
            }
            if (type === "imagegen") {
                return has("model") ? String((d as { model?: string }).model || "Kwai-Kolors/Kolors") : "Kwai-Kolors/Kolors";
            }
            return DEFAULT_MODEL; // Fallback for other types
        };

        form.reset({
            label: String(d.label || ""),
            model: getModelDefault(),
            temperature: type === "llm" && has("temperature") ? Number((d as { temperature?: number }).temperature ?? DEFAULT_TEMPERATURE) : DEFAULT_TEMPERATURE,
            systemPrompt: type === "llm" && has("systemPrompt") ? String((d as { systemPrompt?: string }).systemPrompt || "") : "",
            // LLM Memory fields
            enableMemory: type === "llm" && has("enableMemory") ? (d as Record<string, unknown>).enableMemory as boolean : false,
            memoryMaxTurns: type === "llm" && has("memoryMaxTurns") ? (d as Record<string, unknown>).memoryMaxTurns as number : 10,
            // LLM JSON output mode
            responseFormat: type === "llm" ? (has("responseFormat") ? (d as Record<string, unknown>).responseFormat as 'text' | 'json_object' : 'text') : undefined,
            inputMappings: type === "llm"
                ? (has("inputMappings") ? (d as Record<string, unknown>).inputMappings as Record<string, string> : { user_input: "{{user_input}}" })
                : (has("inputMappings") ? (d as Record<string, unknown>).inputMappings as Record<string, string> : {}),

            text: type === "input" && has("text") ? String((d as { text?: string }).text || "") : "",
            // Input node specific fields
            enableTextInput: type === "input" && has("enableTextInput") ? (d as Record<string, unknown>).enableTextInput as boolean : true,
            enableFileInput: type === "input" && has("enableFileInput") ? (d as Record<string, unknown>).enableFileInput as boolean : false,
            enableStructuredForm: type === "input" && has("enableStructuredForm") ? (d as Record<string, unknown>).enableStructuredForm as boolean : false,
            fileRequired: type === "input" && has("fileRequired") ? (d as Record<string, unknown>).fileRequired as boolean : false,
            fileConfig: type === "input" && has("fileConfig") ? (d as Record<string, unknown>).fileConfig as { allowedTypes: string[]; maxSizeMB: number; maxCount: number } : undefined,
            formFields: type === "input" && has("formFields") ? (d as Record<string, unknown>).formFields as unknown[] : undefined,
            greeting: type === "input" && has("greeting") ? String((d as Record<string, unknown>).greeting || "") : "",
            toolType: type === "tool" && has("toolType") ? String((d as { toolType?: string }).toolType || DEFAULT_TOOL_TYPE) : DEFAULT_TOOL_TYPE,
            inputs: type === "tool" && has("inputs") ? (d as { inputs?: Record<string, unknown> }).inputs || {} : {},
            // Branch node specific fields
            condition: type === "branch" && has("condition") ? String((d as Record<string, unknown>).condition || "") : "",
            // ImageGen node specific fields
            prompt: type === "imagegen" && has("prompt") ? String((d as any).prompt || "") : "",
            negativePrompt: type === "imagegen" && has("negativePrompt") ? String((d as any).negativePrompt || "") : "",
            imageSize: type === "imagegen" && has("imageSize") ? String((d as any).imageSize || "1024x1024") : "1024x1024",
            cfg: type === "imagegen" && (d as any).cfg != null ? Number((d as any).cfg) : undefined,
            numInferenceSteps: type === "imagegen" && (d as any).numInferenceSteps != null ? Number((d as any).numInferenceSteps) : undefined,
            referenceImageMode: type === "imagegen" && has("referenceImageMode") ? String((d as any).referenceImageMode || "static") : "static",
            referenceImageUrl: type === "imagegen" && has("referenceImageUrl") ? String((d as any).referenceImageUrl || "") : "",
            referenceImageUrl2: type === "imagegen" && has("referenceImageUrl2") ? String((d as any).referenceImageUrl2 || "") : "",
            referenceImageUrl3: type === "imagegen" && has("referenceImageUrl3") ? String((d as any).referenceImageUrl3 || "") : "",
            referenceImageVariable: type === "imagegen" && has("referenceImageVariable") ? String((d as any).referenceImageVariable || "") : "",
            referenceImage2Variable: type === "imagegen" && has("referenceImage2Variable") ? String((d as any).referenceImage2Variable || "") : "",
            referenceImage3Variable: type === "imagegen" && has("referenceImage3Variable") ? String((d as any).referenceImage3Variable || "") : "",
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

            const value = form.getValues(name as any);

            if (name.includes(".")) {
                const [rootKey, ...rest] = name.split(".");
                const { nodes: currentNodes } = useFlowStore.getState();
                const node = currentNodes.find((n) => n.id === selectedNodeId);
                const currentRoot = (node?.data as Record<string, unknown> | undefined)?.[rootKey];

                const setDeep = (input: unknown, path: string[], nextValue: unknown) => {
                    const base =
                        input && typeof input === "object" && !Array.isArray(input)
                            ? { ...(input as Record<string, unknown>) }
                            : {};
                    if (path.length === 0) return base;
                    let cursor = base as Record<string, unknown>;
                    for (let i = 0; i < path.length - 1; i++) {
                        const key = path[i];
                        const existing = cursor[key];
                        const cloned =
                            existing && typeof existing === "object" && !Array.isArray(existing)
                                ? { ...(existing as Record<string, unknown>) }
                                : {};
                        cursor[key] = cloned;
                        cursor = cloned;
                    }
                    cursor[path[path.length - 1]] = nextValue;
                    return base;
                };

                const updatedRoot = setDeep(currentRoot, rest, value);
                updateNodeData(selectedNodeId, { [rootKey]: updatedRoot } as any);
                return;
            }

            updateNodeData(selectedNodeId, { [name]: value } as any);
        });

        return () => subscription.unsubscribe();
    }, [form, selectedNodeId, updateNodeData]);

    // 当选中的节点变化时，标记正在初始化
    useEffect(() => {
        if (selectedNodeId) {
            isInitializing.current = true;
            // 使用 setTimeout 确保 form.reset 完成后再取消初始化状态
            const timer = setTimeout(() => {
                isInitializing.current = false;
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [selectedNodeId]);

    // Calculate derived data conditionally usually
    const type = selectedNode?.type as NodeKind | undefined;
    const rawExecutionOutput = selectedNode ? flowContext[selectedNode.id] : undefined;
    const executionOutput = useMemo(() => {
        if (!selectedNodeType || selectedNodeType !== "branch") {
            return rawExecutionOutput;
        }
        if (!rawExecutionOutput || typeof rawExecutionOutput !== "object") {
            return rawExecutionOutput;
        }
        const data = rawExecutionOutput as Record<string, unknown>;
        const filtered: Record<string, unknown> = {};
        if ("passed" in data) filtered.passed = data.passed;
        if ("condition" in data) filtered.condition = data.condition;
        if ("conditionResult" in data) filtered.conditionResult = data.conditionResult;
        return filtered;
    }, [rawExecutionOutput, selectedNodeType]);
    const nodeLabel = selectedNode?.data?.label as string | undefined;

    // 埋点：节点配置面板打开
    useEffect(() => {
        if (selectedNodeId && type) {
            track('node_config_open', { node_id: selectedNodeId, node_type: type });
        }
    }, [selectedNodeId, type]);

    // Check if this node is currently running
    const isNodeRunning = selectedNodeId ? runningNodeIds.has(selectedNodeId) : false;
    const nodeStatus = (selectedNode?.data?.status as ExecutionStatus) || "idle";

    const handleTestNode = () => {
        if (!selectedNodeId || !selectedNode) return;

        // 埋点：测试按钮点击
        track('node_test_click', { node_id: selectedNodeId, node_type: type });

        // Unified test logic using the same utility as CustomNode
        handleNodeTest(
            selectedNodeId,
            selectedNode,
            nodes,
            edges,
            {
                openDialog,
                openInputPrompt,
                runNode
            }
        );
    };

    return (
        <AnimatePresence mode="wait">
            {selectedNode && type && (
                <motion.div
                    key="context-hud-panel"
                    initial={{ x: panelWidth, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: panelWidth, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="fixed top-6 right-6 max-h-[calc(100vh-48px)] bg-white/95 backdrop-blur-xl border border-gray-200/50 shadow-2xl rounded-2xl flex flex-col z-20 overflow-hidden"
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

                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100/80 bg-white/90 backdrop-blur-xl sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            {/* Node Icon */}
                            <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm transition-colors",
                                NODE_COLORS[type] || "bg-gray-50 text-gray-600 border-gray-100"
                            )}>
                                {NODE_ICONS[type] || <BrainCircuit className="w-4 h-4" />}
                            </div>
                            
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-bold text-gray-900 tracking-tight">
                                    {{
                                        input: "输入节点",
                                        llm: "大模型节点",
                                        rag: "知识库节点",
                                        output: "输出节点",
                                        tool: "工具节点",
                                        branch: "分支节点",
                                        imagegen: "图像生成节点",
                                    }[type] || `${type} 节点`}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {STATUS_ICON[nodeStatus]}
                                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                                        {nodeStatus === 'idle' ? '就绪' : 
                                         nodeStatus === 'running' ? '运行中' : 
                                         nodeStatus === 'completed' ? '成功' : '错误'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={isNodeRunning}
                                            className={cn(
                                                "h-8 px-3 text-xs gap-2 font-medium transition-all duration-300 rounded-lg group",
                                                isNodeRunning
                                                    ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                                                    : "text-indigo-600 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white hover:shadow-md hover:shadow-indigo-500/20 border border-indigo-100 hover:border-transparent"
                                            )}
                                            onClick={handleTestNode}
                                        >
                                            {isNodeRunning ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Play className="w-3.5 h-3.5 fill-current opacity-80 group-hover:opacity-100" />
                                            )}
                                            {isNodeRunning ? "运行中" : "运行"}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        {isNodeRunning ? "运行中…" : "运行此节点"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <div className="w-px h-5 bg-gray-200/60 mx-1" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                onClick={() => {
                                    track('node_config_close', { node_id: selectedNode.id, node_type: type });
                                    setSelectedNode(null);
                                }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {/* Use key here to ensure content refreshes when switching between nodes of same type if needed, 
                            though form.reset handles values. Adding key helps with scroll reset. */}
                        <div className="p-5 space-y-4" key={selectedNode.id}>
                            <Form {...form}>
                                <form className="space-y-4">
                                    {type === "llm" && <LLMNodeForm form={form} />}
                                    {type === "input" && <InputNodeForm form={form} selectedNodeId={selectedNodeId || undefined} updateNodeData={updateNodeData} />}
                                    {type === "rag" && <RAGNodeForm form={form} selectedNodeId={selectedNodeId} updateNodeData={updateNodeData} selectedNode={selectedNode} />}
                                    {type === "output" && <OutputNodeForm form={form} />}
                                    {type === "tool" && <ToolNodeForm form={form} />}
                                    {type === "branch" && <BranchNodeForm form={form} />}
                                    {type === "imagegen" && <ImageGenNodeForm form={form} selectedNodeId={selectedNodeId} updateNodeData={updateNodeData} selectedNode={selectedNode} />}
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
export * from "./types";
