"use client";
import React, { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Wrench, Play } from "lucide-react";
import { useFlowStore } from "@/store/flowStore";
import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOL_REGISTRY, DEFAULT_TOOL_TYPE, type ToolType } from "@/lib/tools/registry";
import type { ToolNodeData, AppNode } from "@/types/flow";
import { isToolNodeParametersConfigured } from "@/store/utils/debugDialogUtils";
import { HANDLE_STYLE } from "../constants";

// ============ Tool Node Component ============

const ToolNode = ({ id, data, selected }: NodeProps) => {
    const nodeData = data as ToolNodeData;
    // PERFORMANCE: Only subscribe to function references, not data
    // nodes is fetched on-demand in handleTestNode to avoid re-renders
    const { openToolDebugDialog, runNode, runningNodeIds } = useFlowStore(
        useShallow((s) => ({
            openToolDebugDialog: s.openToolDebugDialog,
            runNode: s.runNode,
            runningNodeIds: s.runningNodeIds,
        }))
    );

    // Check if this node is currently running
    const isNodeRunning = runningNodeIds.has(id as string);
    const toolType = (nodeData.toolType as ToolType) || DEFAULT_TOOL_TYPE;
    const toolConfig = TOOL_REGISTRY[toolType];
    const ToolIcon = toolConfig?.icon || Wrench;

    // Memoize callback to prevent unnecessary re-renders
    const handleTestNode = useCallback(() => {
        // PERFORMANCE: Fetch nodes on-demand instead of subscribing
        const { nodes } = useFlowStore.getState();
        const currentNode = nodes.find(n => n.id === id);
        if (currentNode && isToolNodeParametersConfigured(currentNode)) {
            // 如果参数充分配置，直接运行
            runNode(id as string);
        } else {
            // 否则打开调试弹窗
            openToolDebugDialog(id as string);
        }
    }, [openToolDebugDialog, runNode, id]);

    return (
        <Card
            tabIndex={0}
            className={cn(
                "group relative min-w-[280px] rounded-2xl border bg-white transition-all duration-200 outline-none",
                "border-gray-200 shadow-md",
                selected ? "ring-2 ring-black border-transparent shadow-lg" : "hover:border-gray-300 hover:shadow-lg"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-150">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg border border-gray-200">
                        <ToolIcon className="w-4 h-4 text-foreground" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 tracking-tight">
                        {(nodeData?.label as string) || "Tool Node"}
                    </span>
                </div>
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
            </div>

            {/* Body */}
            <CardContent className="p-4 space-y-2">
                {/* Tool Type Display */}
                <div className="text-xs text-gray-500">
                    <span className="font-semibold">工具:</span> {toolConfig?.name || toolType}
                </div>

                {/* Tool Description */}
                {toolConfig && (
                    <div className="text-xs text-gray-500 italic">
                        {toolConfig.description}
                    </div>
                )}
            </CardContent>

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

export default React.memo(ToolNode);
