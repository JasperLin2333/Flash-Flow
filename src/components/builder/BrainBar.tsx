"use client";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { motion } from "framer-motion";
import { useFlowStore } from "@/store/flowStore";
import { useAuthStore } from "@/store/authStore";
import { userProfileAPI } from "@/services/userProfileAPI";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PromptBubble from "@/components/ui/prompt-bubble";
import type { NodeKind } from "@/types/flow";

import { showError } from "@/utils/errorNotify";
import { track } from "@/lib/trackingService";

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
            placeholder: "告诉 AI 你的想法，为你自动构建工作流...",
            loadingText: "正在构思工作流...",
        },
    },
    nodeTypes: [
        { label: "输入", type: "input" as NodeKind },
        { label: "LLM 生成", type: "llm" as NodeKind },
        { label: "图片生成", type: "imagegen" as NodeKind },
        { label: "RAG 检索", type: "rag" as NodeKind },
        { label: "通用工具", type: "tool" as NodeKind },
        { label: "逻辑分支", type: "branch" as NodeKind },
        { label: "输出", type: "output" as NodeKind },
    ],
} as const;

// ============ Sub-components ============


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
                    <DialogTitle className="text-base font-bold">智能体能力库</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                选择能力模块，组装你的专属智能体
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
                    <DialogTitle className="text-base font-bold">确定要重新构思吗？</DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        新的设计方案将替换当前的工作流，旧方案将无法找回。
                    </DialogDescription>
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

/**
 * 处理 AI 修改指令的核心函数
 * 使用 AI 意图分类决定 patch 模式还是 full 模式
 */



export default function BrainBar() {
    // Initialize from URL param if present
    const searchParams = useSearchParams();
    const [prompt, setPrompt] = useState("");
    const startCopilot = useFlowStore((s) => s.startCopilot);
    const startAgentCopilot = useFlowStore((s) => s.startAgentCopilot);
    const [isGenerating, setIsGenerating] = useState(false);
    // const [mode, setMode] = useState<"generate" | "modify">("generate"); // Modify mode hidden

    // User authentication state for preference persistence
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const authLoading = useAuthStore((s) => s.isLoading);

    // Initialize enablement state - will be updated from database if user is logged in
    const [enableClarification, setEnableClarification] = useState(() => {
        const param = searchParams?.get("enableClarification");
        return param === "true";
    });

    // Initialize generation mode state
    const [generationMode, setGenerationMode] = useState<"quick" | "agent">(() => {
        const modeParam = searchParams?.get("mode");
        return modeParam === "agent" ? "agent" : "quick";
    });

    const [preferencesLoaded, setPreferencesLoaded] = useState(false);

    // Load user preferences from database on mount
    useEffect(() => {
        // Wait for auth to finish initializing before making decisions
        if (authLoading) {
            return;
        }

        if (isAuthenticated && user?.id && !preferencesLoaded) {
            userProfileAPI.getPreferences(user.id).then((prefs) => {
                if (prefs?.enableClarification !== undefined) {
                    setEnableClarification(prefs.enableClarification);
                }
                if (prefs?.generationMode !== undefined) {
                    setGenerationMode(prefs.generationMode);
                }
                setPreferencesLoaded(true);
            }).catch((err) => {
                console.warn("[BrainBar] Failed to load preferences:", err);
                setPreferencesLoaded(true);
            });
        } else if (!isAuthenticated) {
            // Not authenticated, use URL params or defaults
            setPreferencesLoaded(true);
        }
    }, [authLoading, isAuthenticated, user?.id, preferencesLoaded]);

    // Handle toggling clarification with persistence
    const handleToggleClarification = useCallback((enabled: boolean) => {
        setEnableClarification(enabled);
        // Persist to database if user is logged in
        if (isAuthenticated && user?.id) {
            userProfileAPI.updatePreferences(user.id, { enableClarification: enabled }).catch((err) => {
                console.warn("[BrainBar] Failed to save preferences:", err);
            });
        }
    }, [isAuthenticated, user?.id]);

    // Handle switching generation mode with persistence
    const handleGenerationModeChange = useCallback((newMode: "quick" | "agent") => {
        setGenerationMode(newMode);

        // 埋点：生成模式切换
        track('generation_mode_change', { mode: newMode });

        // Auto-disable clarification if switching to quick mode (same as homepage)
        const newClarification = newMode === "quick" ? false : enableClarification;
        if (newMode === "quick") {
            setEnableClarification(false);
        }

        // Persist to database if user is logged in
        if (isAuthenticated && user?.id) {
            userProfileAPI.updatePreferences(user.id, {
                generationMode: newMode,
                enableClarification: newClarification
            }).catch((err) => {
                console.warn("[BrainBar] Failed to save preferences:", err);
            });
        }
    }, [isAuthenticated, user?.id, enableClarification]);

    // Detect if user came from "Agent Mode" (should prefer Agent Copilot even without clarification)
    const urlAgentMode = searchParams?.get("mode") === "agent";

    const setCopilotBackdrop = useFlowStore((s) => s.setCopilotBackdrop);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const addNode = useFlowStore((s) => s.addNode);
    // const setEdges = useFlowStore((s) => s.setEdges);
    // const updateNodeData = useFlowStore((s) => s.updateNodeData);

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
            // Prefer Agent Copilot if:
            // 1. Interactive clarification is enabled
            // 2. OR user is in "Agent Mode" (thinking process enabled)
            // 3. OR user explicitly selected Agent Mode in the UI
            if (enableClarification || urlAgentMode || generationMode === "agent") {
                // Pass enableClarification flag - if false, it just runs Agent Mode without questions
                await startAgentCopilot(prompt, { enableClarification });
            } else {
                await startCopilot(prompt);
            }
            setPrompt("");
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "生成失败，请稍后重试";
            showError("流程生成失败", errorMsg);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = () => {
        if (!prompt.trim()) return;
        setConfirmOpen(true);
    };

    return (
        <motion.div
            initial={CONFIG.animation.initial}
            animate={CONFIG.animation.animate}
            transition={{ ...CONFIG.animation.transition, ease: "easeOut" }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
            <div className="relative">
                <div style={{ width: CONFIG.ui.containerWidth }}>
                    <PromptBubble
                        value={prompt}
                        onChange={setPrompt}
                        onSubmit={handleSubmit}
                        placeholder={isGenerating ? CONFIG.modes.generate.loadingText : CONFIG.modes.generate.placeholder}
                        disabled={isGenerating}
                        singleLine={true}
                        enableClarification={preferencesLoaded ? enableClarification : undefined}
                        onToggleClarification={preferencesLoaded && generationMode === "agent" ? handleToggleClarification : undefined}
                        generationMode={preferencesLoaded ? generationMode : undefined}
                        onGenerationModeChange={preferencesLoaded ? handleGenerationModeChange : undefined}
                    />
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`absolute ${CONFIG.ui.buttonPosition} top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 backdrop-blur-md border border-gray-200/50 shadow-lg hover:bg-white hover:shadow-xl hover:scale-105 transition-all duration-200 text-gray-600 hover:text-black`}
                                onClick={() => setLibraryOpen(true)}
                            >
                                <Plus className="w-5 h-5" />
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
