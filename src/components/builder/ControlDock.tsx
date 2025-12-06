"use client";
import { MousePointer2, Hand, Minus, Plus, Maximize, Play, Network, Trash2 } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useFlowStore } from "@/store/flowStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useZoomControl, ZOOM_LEVELS, ZOOM_TIMING } from "./hooks/useZoomControl";
import { ErrorNotification } from "./ErrorNotification";

// ============ 常量 ============
const ERROR_NOTIFICATION_DELAY = 100; // ms

const BUTTON_CLASS = {
  base: "h-9 w-9 rounded-full transition-all duration-150",
  default: "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
  active: "bg-gray-100 text-gray-900 shadow-sm",
  running: "text-green-600 bg-green-50 shadow-sm",
} as const;

const BUTTON_STYLES = {
  default: `${BUTTON_CLASS.base} ${BUTTON_CLASS.default}`,
  active: `${BUTTON_CLASS.base} ${BUTTON_CLASS.active}`,
  running: `${BUTTON_CLASS.base} ${BUTTON_CLASS.running}`,
} as const;

// ============ 子组件 ============

/**
 * 交互模式选择组件
 */
function InteractionModeGroup({
  interactionMode,
  setInteractionMode,
}: {
  interactionMode: string;
  setInteractionMode: (mode: "select" | "pan") => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={interactionMode === "select" ? BUTTON_STYLES.active : BUTTON_STYLES.default}
              onClick={() => setInteractionMode("select")}
            >
              <MousePointer2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">触控板模式</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={interactionMode === "pan" ? BUTTON_STYLES.active : BUTTON_STYLES.default}
              onClick={() => setInteractionMode("pan")}
            >
              <Hand className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">鼠标模式</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/**
 * 缩放控制组件
 */
function ZoomControls({
  zoomPct,
  zoomIn,
  zoomOut,
  zoomTo,
  fitView,
  organizeNodes,
}: {
  zoomPct: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (zoom: number) => void;
  fitView: () => void;
  organizeNodes: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={BUTTON_STYLES.default}
        onClick={zoomOut}
        aria-label="缩小"
      >
        <Minus className="w-4 h-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-xs font-medium text-gray-700 w-12 text-center select-none rounded-md hover:bg-gray-100 px-1 py-1 cursor-pointer transition-colors">
            {zoomPct}%
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-28">
          {ZOOM_LEVELS.map((pct) => (
            <DropdownMenuItem
              key={pct}
              onClick={() => zoomTo(pct)}
              className="justify-center"
            >
              {pct}%
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className={BUTTON_STYLES.default}
        onClick={zoomIn}
        aria-label="放大"
      >
        <Plus className="w-4 h-4" />
      </Button>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={BUTTON_STYLES.default}
              onClick={fitView}
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">适配视图</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={BUTTON_STYLES.default}
              onClick={organizeNodes}
            >
              <Network className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">整理节点</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/**
 * 运行按钮
 */
function RunButton({
  isRunning,
  runFlow,
}: {
  isRunning: boolean;
  runFlow: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={isRunning ? BUTTON_STYLES.running : "h-9 w-9 rounded-full text-gray-900 hover:bg-gray-100 hover:text-black transition-all duration-150"}
            onClick={() => runFlow()}
            disabled={isRunning}
          >
            <Play className={`w-4 h-4 ${isRunning ? "fill-current" : "fill-gray-900"}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">运行flow</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 清除缓存按钮
 */
function ClearCacheButton({
  onClear,
}: {
  onClear: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={BUTTON_STYLES.default}
            onClick={onClear}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">清除缓存</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


export default function ControlDock() {
  const reactFlow = useReactFlow();
  const { zoomPct, zoomIn, zoomOut, zoomTo, fitView } = useZoomControl(reactFlow);
  const interactionMode = useFlowStore((s) => s.interactionMode);
  const setInteractionMode = useFlowStore((s) => s.setInteractionMode);
  const runFlow = useFlowStore((s) => s.runFlow);
  const executionStatus = useFlowStore((s) => s.executionStatus);
  const executionError = useFlowStore((s) => s.executionError);
  const resetExecution = useFlowStore((s) => s.resetExecution);
  const organizeNodes = useFlowStore((s) => s.organizeNodes);


  const isRunning = executionStatus === "running";
  const [showError, setShowError] = useState(false);

  // ========== 执行错误体会流程 ==========
  useEffect(() => {
    if (executionStatus === "error" && executionError) {
      setShowError(true);
    }
  }, [executionStatus, executionError]);

  const handleRetry = () => {
    setShowError(false);
    resetExecution();
    setTimeout(() => runFlow(), ERROR_NOTIFICATION_DELAY);
  };

  const handleDismiss = () => {
    setShowError(false);
    resetExecution();
  };

  return (
    <>
      {/* 控制库 */}
      <div className="fixed bottom-8 left-8 z-10 flex items-center gap-1 bg-white shadow-xl border border-gray-200 rounded-full px-2 py-1.5 h-12">
        <InteractionModeGroup interactionMode={interactionMode} setInteractionMode={setInteractionMode} />
        <Separator orientation="vertical" className="h-6 bg-gray-200" />
        <ZoomControls zoomPct={zoomPct} zoomIn={zoomIn} zoomOut={zoomOut} zoomTo={zoomTo} fitView={fitView} organizeNodes={organizeNodes} />
        <Separator orientation="vertical" className="h-6 bg-gray-200" />

        <ClearCacheButton onClear={resetExecution} />
        <RunButton isRunning={isRunning} runFlow={runFlow} />
      </div>

      {/* 错误通知 */}
      <ErrorNotification show={showError} message={executionError} onRetry={handleRetry} onDismiss={handleDismiss} />
    </>
  );
}
