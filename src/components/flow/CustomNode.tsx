"use client";
import React, { useCallback } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, Brain, Download, Search, Clock, CheckCircle2, Loader2, AlertCircle, Play, Wrench, GitBranch, Image } from "lucide-react";
import type { LLMNodeData, RAGNodeData, InputNodeData, ExecutionStatus, AppNode, FlowState } from "@/types/flow";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlowStore } from "@/store/flowStore";
import { useShallow } from "zustand/shallow";
import { isToolNodeParametersConfigured } from "@/store/utils/debugDialogUtils";
import { isOutputNodeConfigured } from "@/store/utils/outputNodeUtils";
import { HANDLE_STYLE, METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "./constants";

import {
  LLMMetadata,
  RAGMetadata,
  InputMetadata,
  OutputMetadata,
  ToolMetadata,
  BranchMetadata,
  ImageGenMetadata
} from "./nodes/metadata";
import { handleNodeTest } from "@/store/utils/nodeTestUtils";

// ============ Constants ============
const ICON: Record<string, React.ReactNode> = {
  input: <User className="w-4 h-4 text-foreground" />,
  llm: <Brain className="w-4 h-4 text-foreground" />,
  output: <Download className="w-4 h-4 text-foreground" />,
  rag: <Search className="w-4 h-4 text-foreground" />,
  tool: <Wrench className="w-4 h-4 text-foreground" />,
  branch: <GitBranch className="w-4 h-4 text-foreground" />,
  imagegen: <Image className="w-4 h-4 text-foreground" />,
};

const STATUS_ICON: Record<ExecutionStatus, React.ReactNode> = {
  idle: <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />,
  running: <Loader2 className="w-3 h-3 text-foreground animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-foreground" />,
  error: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const HIDE_DEBUG_NODE_TYPES: string[] = [];  // All node types now support testing

const CustomNode = ({ id, data, type, selected }: NodeProps) => {
  const llm = data as LLMNodeData;
  const rag = data as RAGNodeData;
  const input = data as InputNodeData;
  const status = (data.status as ExecutionStatus) || "idle";
  const executionTime = data.executionTime as number | undefined;

  // PERFORMANCE FIX: Use useShallow for batched store subscriptions
  // NOTE: edges and nodes are NOT subscribed here to avoid re-renders on every node/edge change
  // They are fetched on-demand in handleTestNode using getState()
  const {
    runNode,
    runningNodeIds,
    openDialog,
    openInputPrompt,
    flowContext
  } = useFlowStore(
    useShallow((s) => ({
      runNode: s.runNode,
      runningNodeIds: s.runningNodeIds,
      openDialog: s.openDialog,
      openInputPrompt: s.openInputPrompt,
      flowContext: s.flowContext,
    }))
  );

  // Check if this node is currently running
  const isNodeRunning = runningNodeIds.has(id as string);

  // Branch node: get conditionResult from flowContext for visual feedback
  const branchConditionResult = React.useMemo(() => {
    if (type !== 'branch' || status !== 'completed') return null;
    const nodeOutput = flowContext[id as string] as Record<string, unknown> | undefined;
    if (!nodeOutput) return null;
    return nodeOutput.conditionResult as boolean | undefined;
  }, [type, status, flowContext, id]);

  const renderMetadata = () => {
    switch (type) {
      case "llm":
        return <LLMMetadata llm={llm} />;
      case "rag":
        return <RAGMetadata rag={rag} />;
      case "input":
        return <InputMetadata input={input} />;
      case "output":
        return <OutputMetadata data={data} />;
      case "tool":
        return <ToolMetadata tool={data as import("@/types/flow").ToolNodeData} />;
      case "branch":
        return <BranchMetadata branch={data as import("@/types/flow").BranchNodeData} />;
      case "imagegen":
        return <ImageGenMetadata imageGen={data as import("@/types/flow").ImageGenNodeData} />;
      default:
        return null;
    }
  };

  const handleTestNode = () => {
    // PERFORMANCE: Fetch nodes/edges on-demand instead of subscribing
    // This prevents re-renders when any node/edge changes
    const { nodes, edges } = useFlowStore.getState();

    // 构建完整节点对象以便传递给工具函数
    // 注意：CustomNode 仅接收部分 props，我们从 store 获取完整数据更安全，
    // 但为了性能，这里构造一个临时的 AppNode 对象用于测试逻辑
    // 更好的方式是使用 store 中的完整节点对象
    const currentNode = nodes.find(n => n.id === id);
    if (!currentNode) return;

    handleNodeTest(
      id as string,
      currentNode,
      nodes,
      edges,
      {
        openDialog: openDialog as FlowState['openDialog'],
        openInputPrompt: openInputPrompt as FlowState['openInputPrompt'],
        runNode: runNode as FlowState['runNode']
      }
    );
  };

  return (
    <Card
      tabIndex={0}
      className={cn(
        "group relative min-w-[240px] border bg-white transition-all duration-200 outline-none",
        "border-gray-200 shadow-md",
        // 统一圆角设计：所有节点使用相同的圆角
        "rounded-2xl",
        selected ? "ring-2 ring-black border-transparent shadow-lg" : "hover:border-gray-300 hover:shadow-lg"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
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
                    disabled={isNodeRunning}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all duration-150",
                      isNodeRunning
                        ? "bg-transparent text-gray-300 cursor-not-allowed"
                        : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                    )}
                    onClick={handleTestNode}
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isNodeRunning ? "运行中..." : "测试"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex items-center justify-center w-5 h-5">
            {STATUS_ICON[status]}
          </div>
        </div>
      </div>

      {/* Body */}
      <CardContent className="p-4 flex items-center">
        {renderMetadata() || <div className="text-xs text-gray-400">暂无配置</div>}
      </CardContent>

      {/* Footer (Optional) */}
      {executionTime && (
        <CardFooter className="px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center gap-2">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] font-mono text-gray-600">{(executionTime / 1000).toFixed(2)}s</span>
        </CardFooter>
      )}

      {/* Handles */}
      {/* Input Handle: Show for all EXCEPT Input Node */}
      {type !== 'input' && (
        <Handle
          type="target"
          position={Position.Left}
          className={cn(HANDLE_STYLE, "-ml-[5px]", selected ? "!border-black" : "")}
        />
      )}

      {type === 'branch' ? (
        <>
          {/* True Output - highlight when condition is true */}
          <div className="absolute -right-[5px] top-[40%] flex items-center flex-row-reverse z-10">
            <Handle
              id="true"
              type="source"
              position={Position.Right}
              className={cn(
                HANDLE_STYLE,
                "!relative !transform-none !left-auto !right-auto !bg-green-500 !border-green-600",
                selected ? "!border-black" : "",
                branchConditionResult === true && "!scale-125 !ring-2 !ring-green-400 !ring-opacity-75"
              )}
            />
            <span className={cn(
              "mr-2 text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-tight transition-all duration-300",
              branchConditionResult === true
                ? "text-white bg-green-500 border-green-600 shadow-md animate-pulse"
                : "text-green-600 bg-green-50 border-green-200"
            )}>TRUE</span>
          </div>

          {/* False Output - highlight when condition is false */}
          <div className="absolute -right-[5px] top-[55%] flex items-center flex-row-reverse z-10">
            <Handle
              id="false"
              type="source"
              position={Position.Right}
              className={cn(
                HANDLE_STYLE,
                "!relative !transform-none !left-auto !right-auto !bg-red-500 !border-red-600",
                selected ? "!border-black" : "",
                branchConditionResult === false && "!scale-125 !ring-2 !ring-red-400 !ring-opacity-75"
              )}
            />
            <span className={cn(
              "mr-2 text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-tight transition-all duration-300",
              branchConditionResult === false
                ? "text-white bg-red-500 border-red-600 shadow-md animate-pulse"
                : "text-red-600 bg-red-50 border-red-200"
            )}>FALSE</span>
          </div>
        </>
      ) : (
        /* Output Handle: Show for all EXCEPT Output Node and Branch (handled above) */
        type !== 'output' && (
          <Handle
            type="source"
            position={Position.Right}
            className={cn(HANDLE_STYLE, "-mr-[5px]", selected ? "!border-black" : "")}
          />
        )
      )}
    </Card>
  );
};

export default React.memo(CustomNode);
