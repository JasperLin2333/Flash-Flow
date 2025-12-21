"use client";
import { useState, useCallback } from "react";
import { Plus, Sparkles, Edit3 } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { motion } from "framer-motion";
import { useFlowStore } from "@/store/flowStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PromptBubble from "@/components/ui/prompt-bubble";
import type { AppNode, NodeKind } from "@/types/flow";
import { executeModification as executeModificationService } from "@/store/services/modificationExecutor";
import { showError } from "@/utils/errorNotify";

// ============ 配置常量 ============
const CONFIG = {
    ui: {
        containerWidth: "640px",
        buttonPosition: "-left-14",
        defaultNodePosition: { x: 320, y: 240 },
    },
    animation: {
        initial: { y: 100, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.5 },
    },
    modes: {
        generate: {
            label: "全量生成",
            icon: Sparkles,
            placeholder: "请告诉我们你想要什么…",
            loadingText: "正在生成流程…",
        },
        modify: {
            label: "局部修改",
            icon: Edit3,
            placeholder: "描述你想要修改的内容... 如: LLM节点需要有记忆",
            loadingText: "正在修改流程...",
        },
    },
    nodeTypes: [
        { label: "输入", type: "input" as NodeKind },
        { label: "LLM 生成", type: "llm" as NodeKind },
        { label: "RAG 检索", type: "rag" as NodeKind },
        { label: "通用工具", type: "tool" as NodeKind },
        { label: "逻辑分支", type: "branch" as NodeKind },
        { label: "输出", type: "output" as NodeKind },
    ],
} as const;

// ============ Sub-components ============
function ModeToggle({
    mode,
    setMode,
}: {
    mode: "generate" | "modify";
    setMode: (m: "generate" | "modify") => void;
}) {
    return (
        <div className="absolute -top-14 left-0 flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1.5 shadow-md">
            {(["generate", "modify"] as const).map((m) => {
                const config = CONFIG.modes[m];
                const Icon = config.icon;
                return (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${mode === m
                            ? "bg-black text-white shadow-sm"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            }`}
                        aria-pressed={mode === m}
                    >
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </button>
                );
            })}
        </div>
    );
}

function NodeLibraryDialog({
    open,
    onOpenChange,
    onNodeAdd,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onNodeAdd: (type: NodeKind) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">节点库</DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        选择一个节点添加到画布
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 pt-2">
                    {CONFIG.nodeTypes.map(({ label, type }) => (
                        <NodeTile
                            key={type}
                            label={label}
                            onSelect={() => {
                                onNodeAdd(type);
                                onOpenChange(false);
                            }}
                        />
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ConfirmDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">确认重新生成？</DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">即将用新的 flow 覆盖旧 flow，旧 flow 不可找回。</DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                        取消
                    </Button>
                    <Button className="bg-black text-white hover:bg-black/85 active:bg-black/95 font-semibold transition-colors duration-150" onClick={onConfirm}>
                        确认生成
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function NodeTile({
    label,
    onSelect,
}: {
    label: string;
    onSelect: () => void;
}) {
    return (
        <button
            onClick={onSelect}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-all duration-150"
        >
            <span className="text-sm font-semibold text-gray-900">{label}</span>
        </button>
    );
}

// ============ Utilities ============
/**
 * 处理 AI 修改指令的核心函数
 */
const handleModificationInstruction = async (
    prompt: string,
    nodes: AppNode[],
    edges: any[],
    setNodes: (nodes: AppNode[]) => void,
    setEdges: (edges: any[]) => void,
    updateNodeData: (id: string, data: any) => void,
    setCopilotStatus: (status: "idle" | "thinking" | "completed") => void
) => {
    try {
        const resp = await fetch("/api/modify-flow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, currentNodes: nodes, currentEdges: edges }),
        });

        const instruction = await resp.json();
        executeModificationService(instruction, nodes, edges, setNodes, setEdges, updateNodeData);
        setCopilotStatus("completed");
    } catch (e) {
        console.error("Modification failed:", e);
        setCopilotStatus("idle");
        throw e;
    }
};

export default function BrainBar() {
    const [prompt, setPrompt] = useState("");
    const startCopilot = useFlowStore((s) => s.startCopilot);
    const [isGenerating, setIsGenerating] = useState(false);
    const [mode, setMode] = useState<"generate" | "modify">("generate");

    const setCopilotBackdrop = useFlowStore((s) => s.setCopilotBackdrop);
    const setCopilotStatus = useFlowStore((s) => s.setCopilotStatus);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const addNode = useFlowStore((s) => s.addNode);
    const nodes = useFlowStore((s) => s.nodes);
    const edges = useFlowStore((s) => s.edges);
    const setNodes = useFlowStore((s) => s.setNodes);
    const setEdges = useFlowStore((s) => s.setEdges);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);

    // 使用 ReactFlow hook 获取视口转换方法
    const { screenToFlowPosition } = useReactFlow();

    /**
     * 获取用户屏幕中心对应的画布坐标
     * 使用 window.innerWidth/innerHeight 获取屏幕尺寸，然后转换为画布坐标
     */
    const getViewportCenter = useCallback(() => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        return screenToFlowPosition({ x: centerX, y: centerY });
    }, [screenToFlowPosition]);

    /**
     * 添加节点到屏幕中心位置
     */
    const handleAddNodeToCenter = useCallback((type: NodeKind) => {
        const centerPosition = getViewportCenter();
        addNode(type, centerPosition);
    }, [getViewportCenter, addNode]);

    const confirmGenerate = async () => {
        setConfirmOpen(false);
        setIsGenerating(true);
        setCopilotBackdrop("overlay");
        try {
            await startCopilot(prompt);
            setPrompt("");
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "生成失败，请稍后重试";
            showError("流程生成失败", errorMsg);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleModify = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setCopilotBackdrop("overlay");
        setCopilotStatus("thinking");

        try {
            await handleModificationInstruction(
                prompt,
                nodes,
                edges,
                setNodes,
                setEdges,
                updateNodeData,
                setCopilotStatus
            );
            setPrompt("");
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "修改失败，请稍后重试";
            showError("流程修改失败", errorMsg);
        } finally {
            setIsGenerating(false);
        }
    };
    const handleSubmit = () => {
        if (!prompt.trim()) return;
        mode === "generate" ? setConfirmOpen(true) : handleModify();
    };

    return (
        <motion.div
            initial={CONFIG.animation.initial}
            animate={CONFIG.animation.animate}
            transition={{ ...CONFIG.animation.transition, ease: "easeOut" }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
            <div className="relative">
                <ModeToggle mode={mode} setMode={setMode} />

                <div style={{ width: CONFIG.ui.containerWidth }}>
                    <PromptBubble
                        value={prompt}
                        onChange={setPrompt}
                        onSubmit={handleSubmit}
                        placeholder={isGenerating ? CONFIG.modes[mode].loadingText : CONFIG.modes[mode].placeholder}
                        disabled={isGenerating}
                        singleLine={true}
                    />
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`absolute ${CONFIG.ui.buttonPosition} top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-100`}
                                onClick={() => setLibraryOpen(true)}
                            >
                                <Plus className="w-4 h-4 text-black" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">添加节点</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <NodeLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} onNodeAdd={handleAddNodeToCenter} />
            <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={confirmGenerate} />
        </motion.div>
    );
}
