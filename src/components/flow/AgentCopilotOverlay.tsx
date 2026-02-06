"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles,
    GitGraph,
    Loader2,
    Terminal,
    Zap,
    CheckCircle2,
    ArrowRight,
    ChevronDown,
    Play,
    BrainCircuit,
    Lightbulb,
    Target,
    Check,
    FileJson,
    HelpCircle,
    Box,
    BookOpen,
    LogIn,
    LogOut,
    Code,
    Globe,
    Layers,
    Database,
    Wrench,
    Image as ImageIcon,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFlowStore } from "@/store/flowStore";
import type { FeedItem, ToolCallItem, SuggestionItem, StepItem, ClarificationItem, PlanItem } from "@/types/flow";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { cn } from "@/lib/utils";
import { track } from "@/lib/trackingService";

function stripJsonCodeFences(markdown: string): string {
    if (!markdown) return "";
    return markdown
        .replace(/```(?:json|application\/json)\b[\s\S]*?```/gi, "")
        .replace(/```(?:JSON|APPLICATION\/JSON)\b[\s\S]*?```/g, "");
}

function isEntireJson(text: string): boolean {
    const t = (text || "").trim();
    if (!t) return false;
    if (!(t.startsWith("{") || t.startsWith("["))) return false;
    if (!(t.endsWith("}") || t.endsWith("]"))) return false;
    try {
        JSON.parse(t);
        return true;
    } catch {
        return false;
    }
}

function sanitizeNoJson(text: string): string {
    const withoutJsonFences = stripJsonCodeFences(text || "");
    const trimmed = withoutJsonFences.trim();
    if (!trimmed) return "";
    if (isEntireJson(trimmed)) return "";
    return withoutJsonFences;
}

// ========== Shared UI Components ==========

/**
 * ThinkingIndicator - 新版优雅的加载状态
 */
function ThinkingIndicator() {
    return (
        <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            <span className="text-sm font-semibold bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                AI 正在整理方案…
            </span>
        </div>
    );
}

function formatToolLabel(tool: string) {
    const labels: Record<string, string> = {
        web_search: "联网搜索",
        url_reader: "读取网页内容",
        calculator: "计算",
        datetime: "获取时间",
        code_interpreter: "代码执行",
        validate_flow: "工作流校验",
        rag_search: "知识库检索",
    };
    const base = labels[tool] || tool.replace(/_/g, " ");
    return `${base}（${tool}）`;
}

/**
 * UnifiedStep: The base layout for all agent actions to ensure visual consistency
 */
interface UnifiedStepProps {
    icon: any;
    label: string;
    color: string;
    bg: string;
    status: 'pending' | 'streaming' | 'completed' | 'error';
    children?: React.ReactNode;
    isLast?: boolean;
    defaultCollapsed?: boolean;
    collapsible?: boolean;
    previewText?: string;
}

function UnifiedStep({
    icon: Icon,
    label,
    color,
    bg,
    status,
    children,
    isLast = false,
    defaultCollapsed = true,
    collapsible = true,
    previewText
}: UnifiedStepProps) {
    // Determine collapsed state
    const isStreaming = status === 'streaming';
    const isPending = status === 'pending';
    const isCompleted = status === 'completed';

    const [isOpen, setIsOpen] = useState(!defaultCollapsed);
    const contentRef = useRef<HTMLDivElement>(null);
    const userScrolledInsideRef = useRef(false);

    // Auto-state management
    useEffect(() => {
        if (status === 'streaming' || status === 'pending' || status === 'error') {
            setIsOpen(true);
            userScrolledInsideRef.current = false;
        } else if (status === 'completed') {
            setIsOpen(false);
        }
    }, [status]);

    // Detect user scroll inside this step's content area
    const handleInternalScroll = () => {
        if (!contentRef.current) return;
        const el = contentRef.current;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
        if (!isAtBottom) {
            userScrolledInsideRef.current = true;
        } else {
            userScrolledInsideRef.current = false;
        }
    };

    // Auto-scroll internal content when streaming
    useEffect(() => {
        if (isStreaming && contentRef.current && !userScrolledInsideRef.current) {
            // Use requestAnimationFrame for smoother scrolling
            requestAnimationFrame(() => {
                if (contentRef.current) {
                    contentRef.current.scrollTo({
                        top: contentRef.current.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }, [children, isStreaming]);

    const toggle = () => {
        if (collapsible) {
            const newState = !isOpen;
            setIsOpen(newState);
            track(newState ? 'step_expand' : 'step_collapse', { step_type: label });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 group mb-6 relative"
        >
            {/* Timeline Line */}
            {!isLast && (
                <div className="absolute left-[15px] top-10 bottom-[-24px] w-[2px] bg-gradient-to-b from-slate-200/80 to-slate-100/20 -z-10 rounded-full" />
            )}

            {/* Icon */}
            <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 z-10 transition-all duration-500 relative overflow-hidden",
                isCompleted
                    ? "bg-white border-slate-200 text-slate-400 shadow-sm"
                    : isPending
                        ? "bg-white border-slate-200 text-slate-300 shadow-sm"
                        : `${bg} ${color} border-transparent shadow-md ring-2 ring-white/50`
            )}>
                {/* Active Pulse Effect */}
                {isStreaming && (
                    <div className="absolute inset-0 bg-current opacity-10 animate-pulse" />
                )}

                {isCompleted ? (
                    <Check className="w-4 h-4" />
                ) : isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                ) : (
                    <Icon className={cn(
                        "w-4 h-4 relative z-10",
                        isStreaming && (label === "自动修复优化" ? "animate-spin" : "animate-pulse")
                    )} />
                )}
            </div>

            {/* Content Body */}
            <div className="flex-1 min-w-0 pt-0.5">
                {/* Header */}
                <div
                    onClick={toggle}
                    className={cn(
                        "flex items-center gap-2 mb-2 transition-all -ml-2 px-2 py-1.5 rounded-lg border border-transparent select-none",
                        collapsible ? "cursor-pointer hover:bg-slate-100/50 hover:border-slate-200/40" : ""
                    )}
                >
                    <span className={cn(
                        "text-sm font-semibold tracking-tight",
                        isPending ? "text-slate-400" : "text-slate-700"
                    )}>
                        {label}
                    </span>

                    {/* Status Indicators - Only show when actually streaming */}
                    {isStreaming && (
                        <div className="flex gap-1 items-center h-3 mb-0.5 ml-2">
                            <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse" />
                            <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse delay-75" />
                            <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse delay-150" />
                        </div>
                    )}

                    {/* Toggle Indicator */}
                    {collapsible && !isStreaming && !isPending && (
                        <div className="ml-auto flex items-center gap-1.5 transition-opacity text-slate-400 group-hover:text-slate-500">
                            <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                {isOpen ? "收起" : "展开"}
                            </span>
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                        </div>
                    )}
                </div>

                {/* Content */}
                <AnimatePresence initial={false}>
                    {isOpen && children && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div
                                ref={contentRef}
                                onScroll={handleInternalScroll}
                                className={cn(
                                    "rounded-xl border p-4 shadow-sm transition-all duration-300 mb-2 max-h-60 overflow-y-auto custom-scrollbar",
                                    isStreaming
                                        ? "bg-white/90 border-blue-200/60 shadow-blue-500/5 ring-1 ring-blue-500/10"
                                        : "bg-slate-50/50 border-slate-200/60"
                                )}>
                                {children}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Collapsed Preview */}
                {!isOpen && !isPending && previewText && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={toggle}
                        className="text-xs text-slate-500/80 cursor-pointer hover:text-slate-700 transition-colors mt-1 truncate max-w-[90%] font-medium pl-1"
                    >
                        {previewText.slice(0, 60)}{previewText.length > 60 ? "..." : ""}
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

// ========== Specific Item Renderers ==========

function StepBlockRender({ item, isLast }: { item: StepItem, isLast: boolean }) {
    const showValidationSteps = process.env.NEXT_PUBLIC_FLOW_VALIDATION_REPORT_UI === "true";
    if ((item.stepType === "validation" || item.stepType === "validation_fix") && !showValidationSteps) {
        return null;
    }
    if (item.stepType === "retry") {
        return null;
    }

    const visibleContent = sanitizeNoJson(item.content || "");
    const isTitleOnly = item.stepType === "plan_confirm" || item.stepType === "plan_adjust" || item.stepType === "result_prep";
    const titleOnlyDescriptions: Record<string, string> = {
        plan_confirm: "确认这份方案后，我会按这个流程开始生成工作流。",
        plan_adjust: "正在按你的反馈调整方案。完成后，我会请你再确认一次。",
        result_prep: "正在把方案转换成节点和连线，并自动排版后保存。"
    };
    const titleOnlyDescription = titleOnlyDescriptions[item.stepType] || "";

    const stepConfig: Record<string, any> = {
        analysis: { icon: Target, label: "梳理需求", color: "text-indigo-600", bg: "bg-indigo-50/50 border-indigo-100/50" },
        plan_confirm: { icon: CheckCircle2, label: "确认方案", color: "text-blue-700", bg: "bg-blue-50/60 border-blue-100/60" },
        plan_adjust: { icon: Wrench, label: "调整方案", color: "text-amber-700", bg: "bg-amber-50/60 border-amber-100/60" },
        mapping: { icon: Layers, label: "拆成节点", color: "text-blue-600", bg: "bg-blue-50/50 border-blue-100/50" },
        data_flow: { icon: GitGraph, label: "对齐输入输出", color: "text-violet-600", bg: "bg-violet-50/50 border-violet-100/50" },
        strategy: { icon: BrainCircuit, label: "安排分工", color: "text-violet-600", bg: "bg-violet-50/50 border-violet-100/50" },
        reflection: { icon: Lightbulb, label: "检查并优化", color: "text-amber-600", bg: "bg-amber-50/50 border-amber-100/50" },
        modified_plan: { icon: Wrench, label: "应用优化", color: "text-rose-600", bg: "bg-rose-50/50 border-rose-100/50" },
        drafting: { icon: FileJson, label: "补齐配置", color: "text-slate-600", bg: "bg-slate-50/50 border-slate-100/50" },
        verification: { icon: Check, label: "安全检查", color: "text-emerald-600", bg: "bg-emerald-50/50 border-emerald-100/50" },
        result_prep: { icon: FileJson, label: "生成并保存", color: "text-slate-600", bg: "bg-slate-50/50 border-slate-100/50" },
        validation: { icon: Check, label: "结构检查", color: "text-amber-700", bg: "bg-amber-50/60 border-amber-100/60" },
        validation_fix: { icon: Wrench, label: "自动修复", color: "text-amber-700", bg: "bg-amber-50/60 border-amber-100/60" },
        rag_context: { icon: Database, label: "RAG 上下文", color: "text-teal-700", bg: "bg-teal-50/60 border-teal-100/60" }
    };

    let config = stepConfig[item.stepType] || {
        icon: Sparkles,
        label: item.stepType,
        color: "text-slate-600",
        bg: "bg-slate-50/50 border-slate-100/50"
    };

    return (
        <UnifiedStep
            icon={config.icon}
            label={config.label}
            color={config.color}
            bg={config.bg}
            status={item.status}
            isLast={isLast}
            previewText={sanitizeNoJson(item.content || "").replace(/[#*`]/g, '')}
        >
            {isTitleOnly
                ? (titleOnlyDescription ? (
                    <div className="text-xs leading-relaxed text-slate-500/80 py-2">
                        {titleOnlyDescription}
                    </div>
                ) : null)
                : (visibleContent ? (
                    <MarkdownRenderer
                        content={visibleContent}
                        isStreaming={item.status === 'streaming'}
                        className="text-xs leading-relaxed text-slate-600/90 prose-p:my-1 prose-pre:my-2 prose-li:my-0.5 [&>p]:leading-relaxed [&>ul]:my-1"
                    />
                ) : item.status === 'streaming' ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>正在生成中…</span>
                    </div>
                ) : null)}
        </UnifiedStep>
    );
}

function ToolCallBlockRender({ item, isLast }: { item: ToolCallItem, isLast: boolean }) {
    // Hide 'validate_flow' if it's already covered by the Validation Step to reduce noise
    // But keep others
    if (item.tool === 'validate_flow') return null;

    const rawResultText = typeof item.result === "string" ? item.result : "";
    const visibleResultText = isEntireJson(rawResultText) ? "" : sanitizeNoJson(rawResultText);
    const shouldHideResult = typeof item.result !== "string" || !visibleResultText;

    return (
        <UnifiedStep
            icon={Terminal}
            label={`调用工具：${formatToolLabel(item.tool)}`}
            color="text-indigo-600"
            bg="bg-indigo-50/50 border-indigo-100/50"
            status={item.status === 'calling' ? 'streaming' : item.status === 'error' ? 'error' : 'completed'}
            isLast={isLast}
            previewText={shouldHideResult ? "已隐藏结果（结构数据）" : visibleResultText}
        >
            {shouldHideResult ? (
                <div className="text-xs leading-relaxed text-slate-500/80 py-2">已隐藏结果（包含结构数据）</div>
            ) : (
                <div className="text-xs leading-relaxed font-mono text-slate-600/90 whitespace-pre-wrap break-all max-h-60 overflow-y-auto custom-scrollbar">
                    {visibleResultText}
                </div>
            )}
        </UnifiedStep>
    );
}

function SuggestionBlockRender({ item, isLast }: { item: SuggestionItem, isLast: boolean }) {
    return (
        <UnifiedStep
            icon={Zap}
            label={item.scenario ? `实用建议：${item.scenario}` : "实用建议"}
            color="text-amber-600"
            bg="bg-amber-50/50 border-amber-100/50"
            status="completed"
            isLast={isLast}
            defaultCollapsed={false} // Suggestions should usually be visible? Or maybe collapsed if long. Let's keep visible.
            previewText={item.content}
        >
            <div className="text-xs leading-relaxed text-slate-600/90 font-medium">
                {item.content}
            </div>
        </UnifiedStep>
    );
}

/**
 * InlineClarificationCard - 内联式澄清卡片
 * 替代原来的全屏弹窗，直接在 Feed 流中显示
 */
function InlineClarificationCard({ item }: { item: ClarificationItem }) {
    const submitClarification = useFlowStore(s => s.submitClarification);
    const currentCopilotPrompt = useFlowStore(s => s.currentCopilotPrompt);
    const [answers, setAnswers] = useState<string[]>(new Array(item.questions.length).fill(""));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!currentCopilotPrompt) return;
        setIsSubmitting(true);
        try {
            await submitClarification(currentCopilotPrompt, answers);
        } catch (e) {
            console.error("Failed to submit clarification", e);
            setIsSubmitting(false);
        }
    };

    const isAllFilled = answers.every(a => a.trim().length > 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-2xl p-5 shadow-lg ring-1 ring-amber-900/5"
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-5 h-5 text-amber-600" />
                <span className="text-amber-700 font-bold text-base">再确认两件事</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">回答下面问题，我就能更贴合你的想法生成工作流：</p>

            {/* Questions */}
            <div className="space-y-3 mb-4">
                {item.questions.map((q, idx) => (
                    <div key={idx} className="bg-white/60 p-4 rounded-xl border border-slate-200/60 shadow-sm">
                        <div className="flex gap-2 mb-2 items-start">
                            <span className="text-amber-500 font-bold shrink-0">Q{idx + 1}:</span>
                            <span className="text-sm font-medium text-slate-700">{q}</span>
                        </div>
                        <Input
                            value={answers[idx]}
                            onChange={e => {
                                const newAnswers = [...answers];
                                newAnswers[idx] = e.target.value;
                                setAnswers(newAnswers);
                            }}
                            disabled={isSubmitting}
                            placeholder="写下你的回答…"
                            className="bg-slate-50/50 border-slate-200 focus:bg-white transition-colors"
                        />
                    </div>
                ))}
            </div>

            {/* Action Button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !isAllFilled}
                    className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            提交中…
                        </>
                    ) : (
                        <>
                            提交并继续生成
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>
            </div>
        </motion.div>
    );
}

/**
 * PlanPreviewCard - 任务规划预览卡片（内联式）
 * 替代 StandaloneClarificationCard，无全屏遮罩
 */
function PlanPreviewCard({ item }: { item: PlanItem }) {
    const confirmPlan = useFlowStore(s => s.confirmPlan);
    const adjustPlan = useFlowStore(s => s.adjustPlan);
    const [isEditMode, setIsEditMode] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await confirmPlan();
        } catch (e) {
            console.error("Failed to confirm plan", e);
            setIsSubmitting(false);
        }
    };

    const handleAdjust = async () => {
        if (!feedback.trim()) return;
        setIsSubmitting(true);
        try {
            await adjustPlan(feedback);
        } catch (e) {
            console.error("Failed to adjust plan", e);
            setIsSubmitting(false);
        }
    };

    // Check if we have the new structured data
    const { refinedIntent, workflowNodes, useCases, howToUse, verificationQuestions } = item;
    const hasNewFormat = !!(refinedIntent || (workflowNodes && workflowNodes.length > 0));

    // DEBUG: Trace verificationQuestions data
    console.log('[PlanPreviewCard] item:', item);
    console.log('[PlanPreviewCard] verificationQuestions:', verificationQuestions);

    // Helper to get icon for node type
    const getNodeIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('input')) return LogIn;
        if (t.includes('output')) return LogOut;
        if (t.includes('llm') || t.includes('ai')) return Sparkles;
        if (t.includes('code')) return Code;
        if (t.includes('web') || t.includes('api')) return Globe;
        if (t.includes('rag') || t.includes('db')) return Database;
        if (t.includes('tool')) return Wrench;
        if (t.includes('image')) return ImageIcon;
        return Layers; // Default
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-2xl p-5 shadow-lg ring-1 ring-blue-900/5"
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span className="text-blue-700 font-bold text-base">方案预览</span>
            </div>

            {hasNewFormat ? (
                <div className="space-y-6 mb-6">
                    {/* 1. Intent - Clean, No Label */}
                    <div className="text-sm text-slate-800 font-medium leading-relaxed bg-white/60 p-3 rounded-xl border border-blue-100/50">
                        <span className="text-blue-600 font-bold">目标：</span>
                        {refinedIntent || item.userPrompt}
                    </div>

                    {/* 2. Visual Workflow Diagram */}
                    {workflowNodes && workflowNodes.length > 0 && (
                        <div className="relative">
                            <div className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide flex items-center gap-1 pl-1">
                                <Box className="w-3 h-3" /> 主要步骤
                            </div>

                            <div className="flex flex-col md:flex-row flex-wrap items-start gap-3">
                                {workflowNodes.map((node, i) => {
                                    const NodeIcon = getNodeIcon(node.type || 'default');
                                    return (
                                        <div key={i} className="flex items-center group relative">
                                            {/* Node Card */}
                                            <div className="flex flex-col gap-1.5 bg-white/80 p-3 rounded-xl border border-slate-200/60 shadow-sm w-[140px] h-[90px] hover:border-blue-300 hover:shadow-md transition-all">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                        <NodeIcon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-700 truncate" title={node.label}>{node.label}</div>
                                                </div>
                                                <div className="text-[10px] text-slate-500 leading-snug line-clamp-2">
                                                    {node.description}
                                                </div>
                                            </div>

                                            {/* Arrow (except last) */}
                                            {i < workflowNodes.length - 1 && (
                                                <ArrowRight className="w-4 h-4 text-slate-300 mx-2 hidden md:block" />
                                            )}
                                            {/* Arrow for mobile (vertical) */}
                                            {i < workflowNodes.length - 1 && (
                                                <ArrowRight className="w-4 h-4 text-slate-300 my-1 mx-auto rotate-90 md:hidden md:rotate-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 3. Use Cases */}
                        {useCases && useCases.length > 0 && (
                            <div className="bg-blue-50/40 rounded-xl p-3 border border-blue-100/50">
                                <div className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
                                    <Target className="w-3 h-3" /> 适用场景
                                </div>
                                <ul className="space-y-1">
                                    {useCases.map((useCase, i) => (
                                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5 leading-snug">
                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <MarkdownRenderer content={sanitizeNoJson(useCase)} className="text-xs text-slate-600 [&>p]:leading-snug [&>p]:my-0" />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 4. How To Use */}
                        {howToUse && howToUse.length > 0 && (
                            <div className="bg-emerald-50/40 rounded-xl p-3 border border-emerald-100/50">
                                <div className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" /> 使用方法
                                </div>
                                <ol className="space-y-1">
                                    {howToUse.map((step, i) => (
                                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5 leading-snug">
                                            <span className="font-mono text-emerald-500 font-bold text-[10px] mt-0.5">{i + 1}.</span>
                                            <div className="flex-1 min-w-0">
                                                <MarkdownRenderer content={sanitizeNoJson(step)} className="text-xs text-slate-600 [&>p]:leading-snug [&>p]:my-0" />
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>

                    {/* 5. Verification Questions - NEW */}
                    {verificationQuestions && verificationQuestions.length > 0 && (
                        <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/50">
                            <div className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5" /> 确认几个问题
                            </div>
                            <ul className="space-y-2">
                                {verificationQuestions.map((question, i) => (
                                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2 leading-relaxed">
                                        <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <span>{question}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-amber-200/40">
                                如果以上问题的答案不是"是"，请点击"修改方案"告诉我你的想法。
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                /* Legacy View */
                <>
                    <div className="mb-3">
                        <span className="text-xs text-slate-500">• 你的需求： </span>
                        <span className="text-sm text-slate-700 font-medium">{item.userPrompt}</span>
                    </div>
                    <div className="bg-white/80 rounded-xl border border-slate-200/60 p-4 mb-4 space-y-2">
                        {item.steps.map((step, idx) => (
                            <div key={idx} className="text-sm text-slate-600 leading-relaxed">
                                <span className="font-mono text-blue-600 mr-2">{idx + 1}.</span>
                                {step}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Edit Mode - Feedback Input */}
            {isEditMode && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-4"
                >
                    <textarea
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="告诉我你想怎么改（例如：增加一个审核步骤、换一种输出形式）"
                        disabled={isSubmitting}
                        className="w-full min-h-[100px] p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition-all resize-none"
                    />
                </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
                {!isEditMode ? (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setIsEditMode(true)}
                            disabled={isSubmitting}
                            className="rounded-xl"
                        >
                            修改方案
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    处理中…
                                </>
                            ) : (
                                <>
                                    确认并生成
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => { setIsEditMode(false); setFeedback(""); }}
                            disabled={isSubmitting}
                            className="rounded-xl"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleAdjust}
                            disabled={isSubmitting || !feedback.trim()}
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    处理中…
                                </>
                            ) : (
                                "提交修改"
                            )}
                        </Button>
                    </>
                )}
            </div>
        </motion.div>
    );
}


// Legacy ClarificationBlockRender kept for Feed history display (read-only)
function ClarificationBlockRender({ item, isLast }: { item: ClarificationItem, isLast: boolean }) {
    return (
        <UnifiedStep
            icon={HelpCircle}
            label="补充信息"
            color="text-amber-600"
            bg="bg-amber-50 border-amber-100"
            status="completed"
            isLast={isLast}
            defaultCollapsed={true}
            previewText={item.questions[0] || "补充问题"}
        >
            <div className="text-xs text-slate-500">
                {item.questions.map((q, i) => (
                    <div key={i} className="mb-1">Q{i + 1}: {q}</div>
                ))}
            </div>
        </UnifiedStep>
    );
}

function HistoryPlanBlockRender({ item, isLast }: { item: PlanItem, isLast: boolean }) {
    const { refinedIntent, workflowNodes } = item;
    const hasNewFormat = !!(refinedIntent || (workflowNodes && workflowNodes.length > 0));

    return (
        <UnifiedStep
            icon={GitGraph}
            label="方案（历史版本）"
            color="text-slate-400"
            bg="bg-slate-50 border-slate-100"
            status="completed"
            isLast={isLast}
            defaultCollapsed={true}
            previewText={refinedIntent || item.userPrompt}
        >
            <div className="opacity-75 grayscale-[0.5]">
                <div className="text-xs font-bold text-slate-500 mb-2">历史快照</div>
                {hasNewFormat ? (
                    <div className="space-y-3">
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="font-bold">目标：</span> {refinedIntent || item.userPrompt}
                        </div>
                        {workflowNodes && (
                            <div className="flex flex-wrap gap-2">
                                {workflowNodes.map((n, i) => (
                                    <div key={i} className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-500">
                                        {n.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {item.steps.map((step, idx) => (
                            <div key={idx} className="text-xs text-slate-500">
                                {idx + 1}. {step}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </UnifiedStep>
    );
}

// ========== Next Step Prediction Logic ==========

function NextStepPreview({ lastItem, isCompleted }: { lastItem: FeedItem | undefined, isCompleted: boolean }) {
    if (isCompleted) return null;

    let nextStepConfig = null;

    if (!lastItem) {
        nextStepConfig = { icon: Target, label: "正在准备…" };
    } else if (lastItem.type === 'step') {
        const step = lastItem as StepItem;
        if (step.status === 'completed') {
            switch (step.stepType) {
                case 'analysis':
                    nextStepConfig = { icon: CheckCircle2, label: "确认方案" };
                    break;
                case 'plan_confirm':
                    nextStepConfig = { icon: Layers, label: "拆成节点" };
                    break;
                case 'plan_adjust':
                    nextStepConfig = { icon: CheckCircle2, label: "等待你确认方案" };
                    break;
                case 'mapping':
                    nextStepConfig = { icon: GitGraph, label: "对齐输入输出" };
                    break;
                case 'data_flow':
                    nextStepConfig = { icon: FileJson, label: "补齐配置" };
                    break;
                case 'strategy':
                    nextStepConfig = { icon: Lightbulb, label: "检查并优化" };
                    break;
                case 'reflection':
                    // After reflection comes modified_plan (optimization)
                    nextStepConfig = { icon: Wrench, label: "应用优化" };
                    break;
                case 'modified_plan':
                    // After modified_plan comes drafting
                    nextStepConfig = { icon: FileJson, label: "补齐配置" };
                    break;
                case 'drafting':
                    break;
                case 'verification':
                    break;
            }
        }
    } else if (lastItem.type === 'plan') {
        nextStepConfig = { icon: Layers, label: "拆成节点" };
    } else if (lastItem.type === 'tool-call') {
        // If a tool call just finished, maybe Suggestion next?
        nextStepConfig = { icon: Zap, label: "整理建议" };
    }

    if (!nextStepConfig) return null;

    return (
        <UnifiedStep
            icon={nextStepConfig.icon}
            label={nextStepConfig.label}
            color="text-slate-400"
            bg="bg-slate-50"
            status="pending"
            isLast={true}
            collapsible={false}
        />
    );
}


// ========== Main Component ==========

export default function AgentCopilotOverlay() {
    const copilotStatus = useFlowStore((s) => s.copilotStatus);
    const feed = useFlowStore((s) => s.copilotFeed);
    const copilotMode = useFlowStore((s) => s.copilotMode);

    // Auto-scroll refs
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // CRITICAL: Track user intent - has user manually scrolled away from bottom?
    const userHasScrolledAwayRef = useRef(false);

    // Detect user scroll intent in REAL-TIME via onScroll event
    // This is the KEY fix - we capture user intent immediately, not in useEffect
    const handleMainScroll = () => {
        if (!scrollContainerRef.current) return;
        const el = scrollContainerRef.current;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;

        if (isAtBottom) {
            // User scrolled back to bottom - resume auto-scroll
            userHasScrolledAwayRef.current = false;
        } else {
            // User scrolled away from bottom - stop auto-scroll
            userHasScrolledAwayRef.current = true;
        }
    };

    // Auto-scroll to bottom when new content arrives (ONLY if user hasn't scrolled away)
    useEffect(() => {
        // Skip if user has explicitly scrolled away
        if (userHasScrolledAwayRef.current) return;

        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [feed.length, feed]);

    const isActive = copilotStatus !== "idle" && copilotMode === "agent";
    const isCompleted = copilotStatus === "completed";
    const isAwaitingInput = copilotStatus === "awaiting_input";
    const isAwaitingPlanConfirm = copilotStatus === "awaiting_plan_confirm";

    const filteredFeed = useMemo(() => feed, [feed]);

    const lastPlanIndex = useMemo(() => {
        for (let i = filteredFeed.length - 1; i >= 0; i--) {
            if (filteredFeed[i].type === 'plan') return i;
        }
        return -1;
    }, [filteredFeed]);

    if (!isActive) return null;

    const lastFeedItem = filteredFeed.length > 0 ? filteredFeed[filteredFeed.length - 1] : undefined;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-sm p-4 md:p-6"
            >
                {/* Main Container */}
                <motion.div
                    className="w-full max-w-3xl bg-white/80 backdrop-blur-2xl border border-white/40 rounded-2xl shadow-[0_20px_50px_rgb(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.5)] overflow-hidden flex flex-col min-h-[600px] max-h-[85vh] relative ring-1 ring-slate-900/5"
                >
                    {/* Header */}
                    <div className="h-16 border-b border-slate-100/50 bg-white/40 flex items-center justify-between px-6 shrink-0 z-20 relative overflow-hidden">
                        {/* Shimmer Effect for Header */}
                        {!isCompleted && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                        )}

                        <div className="flex items-center gap-3 relative z-10">
                            <div className={cn(
                                "p-2 rounded-xl transition-all shadow-sm ring-1 ring-inset",
                                isCompleted
                                    ? "bg-emerald-50/80 text-emerald-600 ring-emerald-500/10"
                                    : "bg-indigo-50/80 text-indigo-600 ring-indigo-500/10"
                            )}>
                                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className={cn(
                                    "text-sm font-semibold tracking-tight transition-colors",
                                    isCompleted ? "text-emerald-900" : "text-slate-800"
                                )}>
                                    {isCompleted ? "工作流已生成，可以开始使用" : <ThinkingIndicator />}
                                </span>
                            </div>
                        </div>

                        {/* Right Actions: Removed ESC */}
                        <div className="relative z-10">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => useFlowStore.setState({ copilotStatus: 'idle' })}
                                className="rounded-full hover:bg-slate-100 text-slate-400"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Feed Content - Overscroll Contain for "Natural Scrolling" */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleMainScroll}
                        className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200/50 scrollbar-track-transparent bg-slate-50/30"
                    >
                        {/* FIX: Add key based on first item ID to force full remount on new session */}
                        {/* This prevents "flash" of old items animating out when feed is reset */}
                        <AnimatePresence mode="popLayout" key={filteredFeed[0]?.id || 'empty'}>
                            {filteredFeed.map((item, index) => {
                                // Decide if the connector line should be shown
                                const hasPreview = !isCompleted && !isAwaitingInput;
                                const isLastItem = index === filteredFeed.length - 1;
                                const showConnector = !isLastItem || hasPreview;

                                switch (item.type) {
                                    case 'step':
                                        return <StepBlockRender key={item.id} item={item as StepItem} isLast={!showConnector} />;

                                    case 'tool-call':
                                        return <ToolCallBlockRender key={item.id} item={item as ToolCallItem} isLast={!showConnector} />;

                                    case 'suggestion':
                                        return <SuggestionBlockRender key={item.id} item={item as SuggestionItem} isLast={!showConnector} />;

                                    case 'clarification':
                                        // Render inline when awaiting input, or as read-only historical record
                                        if (isAwaitingInput && isLastItem) {
                                            return <InlineClarificationCard key={item.id} item={item as ClarificationItem} />;
                                        }
                                        // Historical - show read-only block
                                        return <ClarificationBlockRender key={item.id} item={item as ClarificationItem} isLast={!showConnector} />;

                                    case 'plan':
                                        // Render PlanPreviewCard inline in the feed
                                        if (isAwaitingPlanConfirm && index === lastPlanIndex) {
                                            return <PlanPreviewCard key={item.id} item={item as PlanItem} />;
                                        }
                                        // Historical plan - show as read-only block
                                        return <HistoryPlanBlockRender key={item.id} item={item as PlanItem} isLast={!showConnector} />;

                                    default:
                                        return null;
                                }
                            })}

                            {/* Predictive Loading State */}
                            {!isCompleted && !isAwaitingInput && !isAwaitingPlanConfirm && (
                                <NextStepPreview key="preview" lastItem={lastFeedItem} isCompleted={isCompleted} />
                            )}
                        </AnimatePresence>

                        {/* Spacer*/}
                        <div className="h-12" />
                    </div>

                    {/* Fixed Footer - Completed State */}
                    {isCompleted && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent shrink-0 z-30 flex justify-center"
                        >
                            <button
                                onClick={() => useFlowStore.setState({ copilotStatus: 'idle' })}
                                className="group relative flex items-center gap-3 px-8 py-3.5 bg-slate-900 text-white text-sm font-bold rounded-full hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-xl shadow-slate-900/20"
                            >
                                <span>打开工作流</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                    )}

                    {/* Clarification is now rendered inline in feed, no footer modal needed */}

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
