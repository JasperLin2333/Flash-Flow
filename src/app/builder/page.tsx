"use client";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FlowCanvas from "@/components/flow/FlowCanvas";
import BrainBar from "@/components/builder/BrainBar";
import ControlDock from "@/components/builder/ControlDock";
import ContextHUD from "@/components/builder/ContextHUD";
import LaunchCard from "@/components/builder/LaunchCard";
import AppModeOverlay from "@/components/builder/AppModeOverlay";
import CopilotOverlay from "@/components/flow/CopilotOverlay";
import { FlowErrorBoundary } from "@/components/FlowErrorBoundary";
import { useFlowStore } from "@/store/flowStore";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Pencil, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { flowAPI } from "@/services/flowAPI";

function BuilderContent() {
    const searchParams = useSearchParams();
    const isAppMode = useFlowStore((s) => s.isAppMode);
    const setAppMode = useFlowStore((s) => s.setAppMode);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const setFlowTitle = useFlowStore((s) => s.setFlowTitle);
    const setFlowIcon = useFlowStore((s) => s.setFlowIcon);
    const setNodes = useFlowStore((s) => s.setNodes);
    const setEdges = useFlowStore((s) => s.setEdges);
    const startCopilot = useFlowStore((s) => s.startCopilot);
    const setCurrentFlowId = useFlowStore((s) => s.setCurrentFlowId);
    const setCopilotBackdrop = useFlowStore((s) => s.setCopilotBackdrop);
    const router = useRouter();
    const hasGeneratedRef = useRef(false);
    // FIX: Add error state to provide user feedback on loading failures
    const [loadError, setLoadError] = useState<string | null>(null);
    // Track if we're in initial copilot generation to avoid rendering canvas
    const [isGeneratingInitial, setIsGeneratingInitial] = useState(false);

    // CRITICAL FIX: Load flow from URL if flowId is present
    // Moved logic inline to avoid unstable function reference in dependencies
    useEffect(() => {
        const initialPrompt = searchParams.get("initialPrompt");
        if (initialPrompt && initialPrompt.trim() && !hasGeneratedRef.current) {
            hasGeneratedRef.current = true;
            setIsGeneratingInitial(true);
            setCopilotBackdrop("blank");
            startCopilot(initialPrompt).then(() => {
                setIsGeneratingInitial(false);
                router.replace("/builder");
            });
            return;
        }
        const flowId = searchParams.get("flowId");
        if (flowId) {
            // FIX: Inline async logic instead of calling external loadFlow function
            // This prevents infinite loop caused by loadFlow reference changing on every render
            (async () => {
                try {
                    setLoadError(null);
                    const flow = await flowAPI.getFlow(flowId);
                    if (flow) {
                        setFlowTitle(flow.name);
                        setFlowIcon(flow.icon_kind, flow.icon_name || undefined, flow.icon_url || undefined);
                        setNodes(flow.data?.nodes || []);
                        setEdges(flow.data?.edges || []);
                        setCurrentFlowId(flow.id);
                    } else {
                        setLoadError(`流程 ${flowId} 未找到`);
                        console.error(`Flow ${flowId} not found`);
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : "加载流程失败";
                    setLoadError(errorMsg);
                    console.error("Failed to load flow:", error);
                }
            })();
        }
    }, [searchParams, setFlowTitle, setNodes, setEdges, setCurrentFlowId, setCopilotBackdrop, startCopilot, router]);

    // If generating initial flow from prompt, show minimal UI with only copilot overlay
    if (isGeneratingInitial) {
        return (
            <div className="h-screen w-screen relative overflow-hidden bg-white">
                <div className="absolute inset-0 z-50 pointer-events-none">
                    <div className="pointer-events-auto">
                        <CopilotOverlay />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen relative overflow-hidden bg-[#FAFAFA]">
            {/* FIX: Error notification for flow loading failures */}
            {loadError && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-700">{loadError}</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLoadError(null)}
                            className="h-6 px-2 text-red-600 hover:text-red-700"
                        >
                            关闭
                        </Button>
                    </div>
                </div>
            )}

            {/* Layer 0: Infinite Canvas */}
            <motion.div
                className="absolute inset-0 z-0"
                animate={{
                    filter: isAppMode ? "blur(8px)" : "blur(0px)",
                    scale: isAppMode ? 0.98 : 1
                }}
                transition={{ duration: 0.5 }}
            >
                <FlowErrorBoundary>
                    <FlowCanvas />
                </FlowErrorBoundary>
            </motion.div>

            {/* Layer 10: Floating Interface (The Cockpit) */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                {/* Enable pointer events for children */}
                <div className="pointer-events-auto">
                    <BrainBar />
                </div>
                <div className="pointer-events-auto">
                    <ControlDock />
                </div>
                <div className="pointer-events-auto">
                    <ContextHUD />
                </div>
                <div className="pointer-events-auto">
                    <LaunchCard />
                </div>

                {/* Top-left Back Button */}
                <div className="pointer-events-auto">
                    <div className="fixed top-6 left-6 z-20">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-100"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="w-4 h-4 text-black" />
                        </Button>
                    </div>
                </div>

                {/* Top-center Title + Preview */}
                <div className="pointer-events-auto">
                    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
                        <div className="group flex items-center gap-2">
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                role="textbox"
                                onBlur={(e) => setFlowTitle(e.currentTarget.textContent || "")}
                                className="inline-flex items-center h-9 px-2 rounded-lg bg-transparent text-sm font-semibold text-black cursor-text hover:bg-gray-100/60 focus:outline-none whitespace-nowrap leading-none"
                            >
                                {flowTitle}
                            </div>
                            <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 self-center" />
                        </div>
                        <Button
                            className="h-9 px-4 rounded-lg bg-black text-white hover:bg-black/90 gap-2"
                            onClick={() => setAppMode(true)}
                        >
                            <Eye className="w-4 h-4" />
                            预览
                        </Button>
                    </div>
                </div>
            </div>

            {/* Layer 50: App Mode Overlay */}
            <div className="absolute inset-0 z-50 pointer-events-none">
                <div className="pointer-events-auto">
                    <AppModeOverlay />
                </div>
                <div className="pointer-events-auto">
                    <CopilotOverlay />
                </div>
            </div>
        </div>
    );
}

export default function BuilderPage() {
    return (
        <ReactFlowProvider>
            <Suspense fallback={<div>Loading...</div>}>
                <BuilderContent />
            </Suspense>
        </ReactFlowProvider>
    );
}
