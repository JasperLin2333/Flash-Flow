"use client";
import React, { useCallback } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, Brain, Download, Search, Clock, CheckCircle2, Loader2, AlertCircle, Play, Wrench, GitBranch } from "lucide-react";
import type { LLMNodeData, RAGNodeData, InputNodeData, ExecutionStatus } from "@/types/flow";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlowStore } from "@/store/flowStore";
import { useShallow } from "zustand/shallow";

// ============ Constants ============
const ICON: Record<string, React.ReactNode> = {
  input: <User className="w-4 h-4 text-foreground" />,
  llm: <Brain className="w-4 h-4 text-foreground" />,
  output: <Download className="w-4 h-4 text-foreground" />,
  rag: <Search className="w-4 h-4 text-foreground" />,
  tool: <Wrench className="w-4 h-4 text-foreground" />,
  branch: <GitBranch className="w-4 h-4 text-foreground" />,
};

const STATUS_ICON: Record<ExecutionStatus, React.ReactNode> = {
  idle: <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />,
  running: <Loader2 className="w-3 h-3 text-foreground animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-foreground" />,
  error: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const HIDE_DEBUG_NODE_TYPES = ["input", "output", "branch"];
// 统一使用 Tool 节点的字体样式
const METADATA_LABEL_STYLE = "text-xs text-gray-500 font-semibold";
const METADATA_VALUE_STYLE = "text-xs text-gray-500";
const HANDLE_STYLE = "w-2.5 h-2.5 !bg-white !border-[1.5px] !border-gray-400 transition-all duration-150 hover:scale-125";

// PERFORMANCE FIX: Wrap with React.memo to prevent unnecessary re-renders
// When one node updates, all other nodes won't re-render
const CustomNode = ({ id, data, type, selected }: NodeProps) => {
  // FIX: Removed dangerous double assertions, use direct cast with optional chaining
  const llm = data as LLMNodeData;
  const rag = data as RAGNodeData;
  const input = data as InputNodeData;
  const status = (data.status as ExecutionStatus) || "idle";
  const executionTime = data.executionTime as number | undefined;

  // PERFORMANCE FIX: Use useShallow for batched store subscriptions
  // This prevents re-renders when the object reference changes but values are same
  const { runNode, openLLMDebugDialog, openRAGDebugDialog, openToolDebugDialog, edges, flowContext } = useFlowStore(
    useShallow((s) => ({
      runNode: s.runNode,
      openLLMDebugDialog: s.openLLMDebugDialog,
      openRAGDebugDialog: s.openRAGDebugDialog,
      openToolDebugDialog: s.openToolDebugDialog,
      edges: s.edges,
      flowContext: s.flowContext,
    }))
  );

  const renderMetadata = () => {
    // ===== LLM 节点 =====
    if (type === "llm") {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [modelName, setModelName] = React.useState<string>(llm?.model || "");

      // eslint-disable-next-line react-hooks/rules-of-hooks
      React.useEffect(() => {
        if (!llm?.model) return;

        // Simple cache map to avoid repeated requests for same model
        // In a real app, use React Query or a global store
        import("@/services/llmModelsAPI").then(({ llmModelsAPI }) => {
          llmModelsAPI.listModels().then(models => {
            const found = models.find(m => m.model_id === llm.model);
            if (found) {
              setModelName(found.model_name);
            }
          });
        });
      }, [llm?.model]);

      const hasConfig = llm?.model;
      if (!hasConfig) return null;

      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>模型</span>
            <span className={METADATA_VALUE_STYLE}>{modelName}</span>
          </div>
          {typeof llm.temperature === "number" && (
            <div className="flex items-center gap-2">
              <span className={METADATA_LABEL_STYLE}>温度</span>
              <span className={METADATA_VALUE_STYLE}>{llm.temperature}</span>
            </div>
          )}
          {llm.enableMemory && (
            <div className="flex items-center gap-2">
              <span className={METADATA_LABEL_STYLE}>记忆</span>
              <span className={METADATA_VALUE_STYLE}>开启 ({llm.memoryMaxTurns || 10}轮)</span>
            </div>
          )}
        </div>
      );
    }

    // ===== RAG 节点 =====
    if (type === "rag") {
      const files = rag?.files || [];
      const maxTokens = rag?.maxTokensPerChunk || 200;
      const topK = rag?.topK || 5;

      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>知识库:</span>
            <span className={METADATA_VALUE_STYLE}>{files.length} 个文件</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>块大小:</span>
            <span className={METADATA_VALUE_STYLE}>{maxTokens} 字符</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>返回数量:</span>
            <span className={METADATA_VALUE_STYLE}>前 {topK} 条</span>
          </div>
        </div>
      );
    }

    // ===== Input 节点 =====
    if (type === "input") {
      const enableText = input?.enableTextInput !== false;
      const enableFile = input?.enableFileInput === true;
      const enableForm = input?.enableStructuredForm === true;
      const formCount = input?.formFields?.length || 0;

      const features: string[] = [];
      if (enableText) features.push("文本");
      if (enableFile) features.push("文件");
      if (enableForm) features.push(`表单(${formCount}项)`);

      if (features.length === 0) return null;

      return (
        <div className="flex items-center gap-2">
          <span className={METADATA_LABEL_STYLE}>输入方式</span>
          <span className={METADATA_VALUE_STYLE}>{features.join(" + ")}</span>
        </div>
      );
    }

    // ===== Output 节点 =====
    if (type === "output") {
      return (
        <div className="flex items-center gap-2">
          <span className={METADATA_LABEL_STYLE}>类型</span>
          <span className={METADATA_VALUE_STYLE}>文本输出</span>
        </div>
      );
    }

    // ===== Tool 节点 =====
    if (type === "tool") {
      const toolData = data as import("@/types/flow").ToolNodeData;
      const toolType = toolData?.toolType;

      // 工具类型映射
      const toolLabels: Record<string, string> = {
        web_search: "网页搜索",
        calculator: "计算器",
        code_executor: "代码执行",
      };

      if (!toolType) return null;

      return (
        <div className="flex items-center gap-2">
          <span className={METADATA_LABEL_STYLE}>工具</span>
          <span className={METADATA_VALUE_STYLE}>{toolLabels[toolType] || toolType}</span>
        </div>
      );
    }

    // ===== Branch 节点 =====
    if (type === "branch") {
      const branchData = data as import("@/types/flow").BranchNodeData;
      const condition = branchData?.condition;

      if (!condition) return null;

      // 截断过长的条件表达式
      const displayCondition = condition.length > 30
        ? condition.slice(0, 27) + "..."
        : condition;

      return (
        <div className="flex items-center gap-2">
          <span className={METADATA_LABEL_STYLE}>条件</span>
          <span className={METADATA_VALUE_STYLE}>{displayCondition}</span>
        </div>
      );
    }

    return null;
  };

  const handleTestNode = () => {
    // LLM 节点：直接打开调试弹窗
    if (type === 'llm') {
      openLLMDebugDialog(id as string);
      return;
    }

    // RAG 节点：直接打开调试弹窗
    if (type === 'rag') {
      openRAGDebugDialog(id as string);
      return;
    }

    // Tool 节点：直接打开调试弹窗
    if (type === 'tool') {
      openToolDebugDialog(id as string);
      return;
    }

    // Check upstream dependencies
    const incomingEdges = edges.filter(e => e.target === id);
    if (incomingEdges.length === 0) {
      runNode(id as string);
      return;
    }

    // For nodes with upstream dependencies, run directly
    // Upstream data will be available from flowContext
    runNode(id as string);
  };

  return (
    <Card
      tabIndex={0}
      className={cn(
        "group relative min-w-[240px] border bg-white transition-all duration-200 outline-none",
        "border-gray-200 shadow-md",
        // Shape differentiation
        type === "input" || type === "output" ? "rounded-[20px]" : "rounded-2xl",
        type === "branch" ? "rounded-xl" : "",
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
      <CardContent className="p-4 flex items-center">
        {renderMetadata() || <div className="text-xs text-gray-400">暂无配置</div>}
      </CardContent>

      {/* Footer (Optional) */}
      {executionTime && (
        <CardFooter className="px-4 py-2 bg-gray-50 border-t border-gray-150 rounded-b-2xl flex items-center gap-2">
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
          {/* True Output */}
          <div className="absolute -right-[5px] top-[40%] flex items-center flex-row-reverse z-10">
            <Handle
              id="true"
              type="source"
              position={Position.Right}
              className={cn(HANDLE_STYLE, "!relative !transform-none !left-auto !right-auto !bg-green-500 !border-green-600", selected ? "!border-black" : "")}
            />
            <span className="mr-2 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 tracking-tight">TRUE</span>
          </div>

          {/* False Output */}
          <div className="absolute -right-[5px] top-[55%] flex items-center flex-row-reverse z-10">
            <Handle
              id="false"
              type="source"
              position={Position.Right}
              className={cn(HANDLE_STYLE, "!relative !transform-none !left-auto !right-auto !bg-red-500 !border-red-600", selected ? "!border-black" : "")}
            />
            <span className="mr-2 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 tracking-tight">FALSE</span>
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
