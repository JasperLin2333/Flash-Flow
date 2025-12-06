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
    const startCopilot = useFlowStore((s) => s.startCopilot);
    const setCopilotBackdrop = useFlowStore((s) => s.setCopilotBackdrop);
    const router = useRouter();
    const hasGeneratedRef = useRef(false);
    // FIX: Track if we're loading a flow to prevent infinite loop
    const isLoadingFlowRef = useRef(false);
    // FIX: Track the last loaded flowId to prevent duplicate loads
    const loadedFlowIdRef = useRef<string | null>(null);
    // FIX: Add error state to provide user feedback on loading failures
    const [loadError, setLoadError] = useState<string | null>(null);

    // FIX (Bug 4): Persist generation state across page refreshes
    // WHY: If user refreshes during generation, we need to restore the loading UI
    const [isGeneratingInitial, setIsGeneratingInitial] = useState(() => {
        // EDGE: Check sessionStorage on mount to restore generation/operation state
        if (typeof window !== 'undefined') {
            const persisted = sessionStorage.getItem('flash-flow:copilot-operation');
            return persisted === 'generating';
        }
        return false;
    });

    // CRITICAL FIX: Subscribe to currentFlowId to auto-sync URL
    // WHY: flowId becomes available asynchronously after save completes
    const currentFlowId = useFlowStore((s) => s.currentFlowId);

    // CRITICAL FIX: Load flow from URL if flowId is present
    // FIX (Bug 2 & 4): Enhanced with URL sync and generation state recovery
    useEffect(() => {
        const initialPrompt = searchParams.get("initialPrompt");
        const flowId = searchParams.get("flowId");

        // SCENARIO 1: User navigated from homepage with a prompt to generate
        if (initialPrompt && initialPrompt.trim() && !hasGeneratedRef.current) {
            hasGeneratedRef.current = true;
            setIsGeneratingInitial(true);
            // Persist to sessionStorage so refresh can restore state
            sessionStorage.setItem('flash-flow:generating', 'true');
            setCopilotBackdrop("blank");

            startCopilot(initialPrompt)
                .then(() => {
                    // ✅ BUG FIX #2: Fixed malformed URL (removed spaces)
                    // BEFORE: `/ builder ? flowId = ${...} ` caused 404
                    // AFTER: `/builder?flowId=${...}` proper URL format
                    const currentFlowId = useFlowStore.getState().currentFlowId;
                    if (currentFlowId) {
                        router.replace(`/builder?flowId=${currentFlowId}`);
                    } else {
                        // EDGE: No flowId yet (save may still be pending), just clean URL
                        router.replace("/builder");
                    }
                })
                .catch((error) => {
                    console.error('Flow generation failed:', error);
                    setLoadError('生成流程失败，请重试');
                })
                .finally(() => {
                    // Clear generation state from sessionStorage
                    sessionStorage.removeItem('flash-flow:generating');
                    setIsGeneratingInitial(false);
                });
            return;
        }

        // SCENARIO 2: User has flowId in URL (either from link or after generation)
        if (flowId && !isGeneratingInitial) {
            // FIX: Skip if already loaded this flow or currently loading
            if (loadedFlowIdRef.current === flowId || isLoadingFlowRef.current) {
                return;
            }

            // FIX: Mark as loading to prevent duplicate loads and skip URL sync
            isLoadingFlowRef.current = true;

            (async () => {
                try {
                    setLoadError(null);
                    const flow = await flowAPI.getFlow(flowId);
                    if (flow) {
                        // FIX: Use direct store.setState to update all values at once
                        // This prevents triggering scheduleSave which would cause infinite loop
                        const store = useFlowStore.getState();
                        useFlowStore.setState({
                            flowTitle: flow.name,
                            flowIconKind: flow.icon_kind,
                            flowIconName: flow.icon_name || undefined,
                            flowIconUrl: flow.icon_url || undefined,
                            nodes: flow.data?.nodes || [],
                            edges: flow.data?.edges || [],
                            currentFlowId: flow.id,
                            saveStatus: "saved", // Mark as saved since we just loaded
                        });

                        // FIX: Mark this flowId as loaded to prevent re-loading
                        loadedFlowIdRef.current = flowId;

                        // EDGE: If we had a pending generation, clear it
                        sessionStorage.removeItem('flash-flow:generating');
                    } else {
                        setLoadError(`流程 ${flowId} 未找到`);
                        console.error(`Flow ${flowId} not found`);
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : "加载流程失败";
                    setLoadError(errorMsg);
                    console.error("Failed to load flow:", error);
                } finally {
                    // FIX: Reset loading flag
                    isLoadingFlowRef.current = false;
                }
            })();
        }

        // SCENARIO 3: Page refreshed during generation (isGeneratingInitial restored from sessionStorage)
        // WHY: We check if generating flag is set but no prompt/flowId in URL
        // This means user refreshed during generation - we should check if flow exists now
        if (isGeneratingInitial && !initialPrompt && !flowId) {
            // EDGE: Check if generation completed while page was refreshing
            const checkForCompletedFlow = async () => {
                const currentFlowId = useFlowStore.getState().currentFlowId;
                if (currentFlowId) {
                    // Flow was saved, redirect to it
                    router.replace(`/builder?flowId=${currentFlowId}`);
                } else {
                    // Generation was interrupted or not yet complete
                    // Clear the flag and show empty canvas
                    sessionStorage.removeItem('flash-flow:generating');
                    setIsGeneratingInitial(false);
                    setLoadError('流程生成过程中页面被刷新，请重新生成');
                }
            };
            checkForCompletedFlow();
        }
    }, [searchParams, setCopilotBackdrop, startCopilot, router, isGeneratingInitial]);

    // CRITICAL FIX (Bug 2): Auto-sync URL when flowId becomes available
    // WHY: After copilot/save completes, currentFlowId is set asynchronously
    // We need to update URL to include flowId for proper refresh behavior
    useEffect(() => {
        const flowIdParam = searchParams.get('flowId');

        // TIMING: Only update URL if we have a flowId but URL doesn't have it yet
        if (currentFlowId && currentFlowId !== flowIdParam) {
            // DEFENSIVE: Avoid infinite loop - only update if actually different
            router.replace(`/builder?flowId=${currentFlowId}`, { scroll: false });
        }
    }, [currentFlowId, searchParams, router]);

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
                                key={flowTitle}
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
