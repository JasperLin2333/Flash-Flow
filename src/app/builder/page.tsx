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
import AgentCopilotOverlay from "@/components/flow/AgentCopilotOverlay";
import { FlowErrorBoundary } from "@/components/FlowErrorBoundary";
import { useFlowStore } from "@/store/flowStore";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Pencil, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { flowAPI } from "@/services/flowAPI";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { track } from "@/lib/trackingService";
import { INITIAL_FLOW_STATE } from "@/store/constants/initialState";

function BuilderContent() {
    const searchParams = useSearchParams();
    const isAppMode = useFlowStore((s) => s.isAppMode);
    const setAppMode = useFlowStore((s) => s.setAppMode);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const setFlowTitle = useFlowStore((s) => s.setFlowTitle);
    const startCopilot = useFlowStore((s) => s.startCopilot);
    const setCopilotBackdrop = useFlowStore((s) => s.setCopilotBackdrop);
    const copilotStatus = useFlowStore((s) => s.copilotStatus);
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
            return persisted ? persisted.startsWith('generating') : false;
        }
        return false;
    });

    // CRITICAL FIX: Subscribe to currentFlowId to auto-sync URL
    // WHY: flowId becomes available asynchronously after save completes
    const currentFlowId = useFlowStore((s) => s.currentFlowId);

    // 🔥 终极修复：强化状态清理逻辑
    // WHY: 防止路由参数累积和状态污染
    useEffect(() => {
        const flowIdParam = searchParams.get('flowId');
        const initialPrompt = searchParams.get('initialPrompt');
        const mode = searchParams.get('mode');
        const enableClarification = searchParams.get('enableClarification');

        // 只有在纯浏览模式下才清理（没有任何参数）
        if (!flowIdParam && !initialPrompt && !mode && !enableClarification) {
            useFlowStore.setState(INITIAL_FLOW_STATE);
            loadedFlowIdRef.current = null;
            hasGeneratedRef.current = false;
            return;
        }

        // 生成模式下只清理特定状态，保留必要参数
        if (initialPrompt) {
            useFlowStore.setState({
                currentFlowId: null,
                executionStatus: "idle",
                flowContext: {}
            });
            loadedFlowIdRef.current = null;
        }
    }, [searchParams]);

    // CRITICAL FIX: Load flow from URL if flowId is present
    // FIX (Bug 2 & 4): Enhanced with URL sync and generation state recovery
    useEffect(() => {
        const initialPrompt = searchParams.get("initialPrompt");
        const flowId = searchParams.get("flowId");

        // SCENARIO 1: User navigated from homepage with a prompt to generate
        if (initialPrompt && initialPrompt.trim() && !hasGeneratedRef.current) {
            hasGeneratedRef.current = true;
            setIsGeneratingInitial(true);

            // Wrap in async IIFE to allow await
            (async () => {
                const mode = searchParams.get("mode");
                let enableClarification = searchParams.get("enableClarification") === "true";
                const shouldPreheatAgent = mode === "agent" || enableClarification;

                if (shouldPreheatAgent) {
                    useFlowStore.setState({
                        copilotStatus: "thinking",
                        copilotMode: "agent",
                        copilotStep: 1,
                        copilotFeed: [{
                            id: `init-analysis-${Date.now()}`,
                            type: 'step',
                            stepType: 'analysis',
                            status: 'streaming',
                            content: '',
                            timestamp: Date.now()
                        }],
                        currentCopilotPrompt: initialPrompt,
                        error: null
                    });
                }

                // ========== Intent Router: Determine if we need planning mode ==========
                // ONLY for agent mode: call /api/intent-router to auto-detect
                if (mode === "agent" && !enableClarification) {
                    try {
                        const routerResp = await fetch("/api/intent-router", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: initialPrompt }),
                        });

                        if (routerResp.ok) {
                            const routerResult = await routerResp.json();
                            // PLAN_MODE = vague request, need clarification
                            // DIRECT_MODE = clear request, skip confirmation
                            enableClarification = routerResult.mode === "PLAN_MODE";
                            console.log(`[Builder] Intent detected: ${routerResult.mode} (confidence: ${routerResult.confidence})`);
                        }
                    } catch (err) {
                        console.warn("[Builder] Intent router failed, defaulting to planning mode:", err);
                        enableClarification = true; // Default to planning mode on error
                    }
                }

                // Persist to sessionStorage so refresh can restore state
                // FIX: Use scoped key to distinguish modes
                const operationMode = (mode === 'agent' || enableClarification) ? 'generating-agent' : 'generating-quick';
                sessionStorage.setItem('flash-flow:copilot-operation', operationMode);
                setCopilotBackdrop("blank");

                // Use Agent API if:
                // 1. mode=agent (thinking chain) OR
                // 2. enableClarification=true (needs clarification flow)
                try {
                    if (mode === "agent" || enableClarification) {
                        await useFlowStore.getState().startAgentCopilot(initialPrompt, {
                            enableClarification,
                            force: shouldPreheatAgent,
                            preserveFeed: shouldPreheatAgent
                        });
                    } else {
                        await startCopilot(initialPrompt);
                    }

                    // ✅ BUG FIX #2: Fixed malformed URL (removed spaces)
                    const currentFlowId = useFlowStore.getState().currentFlowId;
                    if (currentFlowId) {
                        loadedFlowIdRef.current = currentFlowId;
                        router.replace(`/builder?flowId=${currentFlowId}`);
                    }
                } catch (error) {
                    console.error('Flow generation failed:', error);
                    setLoadError('生成流程失败，请重试');
                } finally {
                    sessionStorage.removeItem('flash-flow:copilot-operation');
                    setIsGeneratingInitial(false);
                }
            })();
            return;
        }

        // SCENARIO 2: User has flowId in URL (either from link or after generation)
        if (flowId && !isGeneratingInitial) {
            // FIX: Skip if already loaded this flow or currently loading
            // Also check if store already has this flowId (prevent reload after generation)
            const currentStoreId = useFlowStore.getState().currentFlowId;
            if (loadedFlowIdRef.current === flowId || isLoadingFlowRef.current || currentStoreId === flowId) {
                // If it's a store match, make sure we mark it as loaded so other checks pass
                if (currentStoreId === flowId) {
                    loadedFlowIdRef.current = flowId;
                }
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
                        sessionStorage.removeItem('flash-flow:copilot-operation');
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
                    sessionStorage.removeItem('flash-flow:copilot-operation');
                    setIsGeneratingInitial(false);
                    setLoadError('流程生成过程中页面被刷新，请重新生成');
                }
            };
            checkForCompletedFlow();
        }
    }, [searchParams, setCopilotBackdrop, startCopilot, router, isGeneratingInitial]);

    // 🔥 终极修复：添加生成期间保护的URL同步
    // WHY: 防止生成过程中过早的URL同步导致跳转异常
    useEffect(() => {
        const flowIdParam = searchParams.get('flowId');
        const initialPrompt = searchParams.get('initialPrompt');
        const mode = searchParams.get('mode');
        const enableClarification = searchParams.get('enableClarification');
        const isAgentMode = mode === 'agent' || enableClarification === 'true';

        // 生成期间不执行URL同步（包括Agent模式）
        if (initialPrompt || copilotStatus === "thinking" || isGeneratingInitial) {
            return;
        }

        // Agent模式下保持原有参数
        if (isAgentMode && (mode || enableClarification)) {
            return;
        }

        if (currentFlowId) {
            // Case 1: URL has no ID -> Sync immediately (New blank flow -> Saved)
            if (!flowIdParam) {
                router.replace(`/builder?flowId=${currentFlowId}`, { scroll: false });
            }
            // Case 2: URL has ID but mismatch -> Sync if it's a new generation
            // If currentFlowId changed internally (e.g. Copilot generation) and wasn't just loaded from URL
            else if (flowIdParam !== currentFlowId && currentFlowId !== loadedFlowIdRef.current) {
                // Mark as loaded to prevent the load-effect from re-fetching
                loadedFlowIdRef.current = currentFlowId;
                router.replace(`/builder?flowId=${currentFlowId}`, { scroll: false });
            }
        }
    }, [currentFlowId, searchParams, router, copilotStatus, isGeneratingInitial]);

    // If generating initial flow from prompt, show minimal UI with only copilot overlay
    if (isGeneratingInitial) {
        return (
            <div className="h-screen w-screen relative overflow-hidden bg-white">
                <div className="absolute inset-0 z-50 pointer-events-none">
                    <div className="pointer-events-auto">
                        <CopilotOverlay />
                        <AgentCopilotOverlay />
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

                {/* Top Floating Header Island */}
                <div className="pointer-events-auto fixed top-6 left-1/2 -translate-x-1/2 z-20">
                    <div className="flex items-center gap-1 p-1.5 bg-white/80 backdrop-blur-md border border-gray-200/50 shadow-lg rounded-full transition-all duration-200 hover:shadow-xl hover:border-gray-300/50 hover:bg-white/90">
                        {/* Back Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-black/5 text-gray-600 hover:text-black transition-colors"
                            onClick={() => {
                                // 🔥 智能返回：优先返回首页，避免空白页面
                                const referrer = typeof window !== 'undefined' ? document.referrer : '';
                                if (referrer.includes(window.location.origin + '/') && !referrer.includes('/builder')) {
                                    router.push('/');
                                } else {
                                    router.back();
                                }
                            }}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="w-px h-4 bg-gray-200 mx-1" />

                        {/* Title */}
                        <div className="group flex items-center px-2">
                            <div
                                key={flowTitle}
                                contentEditable
                                suppressContentEditableWarning
                                role="textbox"
                                onBlur={(e) => {
                                    const newTitle = e.currentTarget.textContent || "";
                                    if (newTitle !== flowTitle) {
                                        setFlowTitle(newTitle);
                                        track('flow_title_edit', { new_title_length: newTitle.length });
                                    }
                                }}
                                className="inline-flex items-center h-8 px-2 rounded-md text-sm font-semibold text-gray-800 cursor-text hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-black/5 focus:outline-none whitespace-nowrap leading-none transition-all"
                            >
                                {flowTitle}
                            </div>
                            <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 ml-1.5 transition-opacity" />
                        </div>

                        <div className="w-px h-4 bg-gray-200 mx-1" />

                        {/* Preview Button */}
                        <Button
                            size="sm"
                            className="h-8 px-4 rounded-full bg-black text-white hover:bg-black/80 shadow-sm transition-all hover:scale-105 active:scale-95 ml-1"
                            onClick={() => {
                                setAppMode(true);
                                track('toolbar_btn_click', { button: 'preview' });
                            }}
                        >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            预览运行效果
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
                    <AgentCopilotOverlay />
                </div>
            </div>
        </div>
    );
}

export default function BuilderPage() {
    return (
        <ProtectedRoute>
            <ReactFlowProvider>
                <Suspense fallback={<div>Loading...</div>}>
                    <BuilderContent />
                </Suspense>
            </ReactFlowProvider>
        </ProtectedRoute>
    );
}
