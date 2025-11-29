"use client";
import React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, Brain, Download, Search, Link, Clock, CheckCircle2, Loader2, AlertCircle, Play } from "lucide-react";
import type { LLMNodeData, HttpNodeData, RAGNodeData, InputNodeData, ExecutionStatus } from "@/types/flow";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlowStore } from "@/store/flowStore";

// ============ Constants ============
const ICON: Record<string, React.ReactNode> = {
  input: <User className="w-4 h-4 text-foreground" />,
  llm: <Brain className="w-4 h-4 text-foreground" />,
  output: <Download className="w-4 h-4 text-foreground" />,
  rag: <Search className="w-4 h-4 text-foreground" />,
  http: <Link className="w-4 h-4 text-foreground" />,
};

const STATUS_ICON: Record<ExecutionStatus, React.ReactNode> = {
  idle: <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />,
  running: <Loader2 className="w-3 h-3 text-foreground animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-foreground" />,
  error: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const HIDE_DEBUG_NODE_TYPES = ["input", "output"];
const METADATA_LABEL_STYLE = "text-[10px] font-bold uppercase text-gray-500 tracking-wider";
const METADATA_VALUE_STYLE = "text-xs font-medium text-black";
const HANDLE_STYLE = "w-2.5 h-2.5 !bg-white !border-[1.5px] !border-gray-400 transition-all duration-150 hover:scale-125";

// PERFORMANCE FIX: Wrap with React.memo to prevent unnecessary re-renders
// When one node updates, all other nodes won't re-render
const CustomNode = ({ id, data, type, selected }: NodeProps) => {
  // FIX: Removed dangerous double assertions, use direct cast with optional chaining
  const llm = data as LLMNodeData;
  const http = data as HttpNodeData;
  const rag = data as RAGNodeData;
  const input = data as InputNodeData;
  const status = (data.status as ExecutionStatus) || "idle";
  const executionTime = data.executionTime as number | undefined;
  const runNode = useFlowStore((s) => s.runNode);
  const openLLMDebugDialog = useFlowStore((s) => s.openLLMDebugDialog);
  const edges = useFlowStore((s) => s.edges);
  const flowContext = useFlowStore((s) => s.flowContext);

  const renderMetadata = () => {
    if (type === "llm" && llm?.model) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>模型</span>
            <span className={METADATA_VALUE_STYLE}>{llm.model}</span>
          </div>
          {typeof llm.temperature === "number" && (
            <div className="flex items-center gap-2">
              <span className={METADATA_LABEL_STYLE}>温度</span>
              <span className="text-xs font-mono text-gray-500">{llm.temperature}</span>
            </div>
          )}
        </div>
      );
    }
    if (type === "http") {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>方法</span>
            <span className="text-xs font-bold text-black">{http?.method || "GET"}</span>
          </div>
          <div className="text-xs text-gray-500 truncate max-w-[180px]">{http?.url}</div>
        </div>
      );
    }
    if (type === "rag") {
      const files = rag?.files || [];
      return <span className="text-xs text-gray-500">已上传文件：{files.length}</span>;
    }
    if (type === "input") {
      const txt = input?.text || "无输入";
      return <div className="text-xs text-gray-500 whitespace-pre-wrap break-words">{txt}</div>;
    }
    return null;
  };

  const handleTestNode = () => {
    // LLM 节点：直接打开调试弹窗
    if (type === 'llm') {
      openLLMDebugDialog(id as string);
      return;
    }

    // 其他节点：检查上游依赖
    const incomingEdges = edges.filter(e => e.target === id);
    if (incomingEdges.length === 0) {
      runNode(id as string);
      return;
    }

    const upstreamData = incomingEdges.map(e => flowContext[e.source]);
    const hasMissingData = upstreamData.some(d => !d || (typeof d === 'object' && Object.keys(d).length === 0));

    if (hasMissingData) {
      // 其他节点类型暂时直接运行（未来可以扩展）
      runNode(id as string);
    } else {
      runNode(id as string);
    }
  };

  return (
    <Card
      tabIndex={0}
      className={cn(
        "group relative min-w-[240px] rounded-2xl border bg-white transition-all duration-200 outline-none",
        "border-gray-200 shadow-md",
        selected ? "ring-2 ring-black border-transparent shadow-lg" : "hover:border-gray-300 hover:shadow-lg"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-150">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg border border-gray-200">
            {ICON[type || "llm"]}
          </div>
          <span className="text-sm font-bold text-gray-900 tracking-tight">{(data?.label as string) || type}</span>
        </div>
        <div className="flex items-center gap-1">
          {!HIDE_DEBUG_NODE_TYPES.includes(type as string) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-all duration-150"
                    onClick={handleTestNode}
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">测试节点</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex items-center justify-center w-5 h-5">
            {STATUS_ICON[status]}
          </div>
        </div>
      </div>

      {/* Body */}
      <CardContent className="p-4">
        {renderMetadata() || <div className="text-xs text-gray-500">暂无配置</div>}
      </CardContent>

      {/* Footer (Optional) */}
      {executionTime && (
        <CardFooter className="px-4 py-2 bg-gray-50 border-t border-gray-150 rounded-b-2xl flex items-center gap-2">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] font-mono text-gray-600">{(executionTime / 1000).toFixed(2)}s</span>
        </CardFooter>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(HANDLE_STYLE, "-ml-[5px]", selected ? "!border-black" : "")}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={cn(HANDLE_STYLE, "-mr-[5px]", selected ? "!border-black" : "")}
      />
    </Card>
  );
};

export default React.memo(CustomNode);
