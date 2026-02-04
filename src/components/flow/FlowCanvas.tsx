"use client";
import { useCallback, useMemo, memo, useEffect, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, useReactFlow, SelectionMode, PanOnScrollMode, type Node } from "@xyflow/react";
import { useFlowStore } from "@/store/flowStore";
import { 
  trackNodeSelect, 
  trackKeyboardShortcut, 
  trackCanvasMove, 
  trackSelectionChange,
  trackCanvasClick,
  trackCanvasContextMenu,
  trackNodeDragStart,
  trackNodeDragEnd,
  trackNodeContextMenu
} from "@/lib/trackingService";
import CustomNode from "./CustomNode";
// NOTE: ToolNode is deprecated, all node types now use unified CustomNode
import LLMDebugDialog from "./LLMDebugDialog";
import RAGDebugDialog from "./RAGDebugDialog";
import ToolDebugDialog from "./ToolDebugDialog";
import InputDebugDialog from "./InputDebugDialog";
import OutputDebugDialog from "./OutputDebugDialog";

import BranchDebugDialog from "./BranchDebugDialog";
import ImageGenDebugDialog from "./ImageGenDebugDialog";
import type { NodeKind } from "@/types/flow";

// FIX (Bug 3): Move nodeTypes outside component to prevent recreation on every render
// WHY: Creating a new object on every render causes ReactFlow to re-register node types,
// triggering expensive internal recalculations that cause drag lag
// NOTE: All node types now use unified CustomNode component (ToolNode deprecated)
const nodeTypes = {
  input: CustomNode,
  llm: CustomNode,
  output: CustomNode,
  rag: CustomNode,
  tool: CustomNode,
  branch: CustomNode,
  imagegen: CustomNode,
};

/**
 * FIX (Bug 3): Performance-optimized FlowCanvas with memoization
 * 
 * PERFORMANCE NOTES:
 * - React.memo prevents re-renders when parent components update
 * - useMemo caches defaultEdgeOptions to prevent ReactFlow recalculation
 * - nodeTypes constant moved outside to avoid recreation
 * - These optimizations are critical for smooth 60fps drag performance
 */
function FlowCanvasComponent() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const addNode = useFlowStore((s) => s.addNode);
  const interactionMode = useFlowStore((s) => s.interactionMode);
  const copyNode = useFlowStore((s) => s.copyNode);
  const pasteNode = useFlowStore((s) => s.pasteNode);
  const { screenToFlowPosition } = useReactFlow();
  
  // 拖拽状态跟踪
  const [dragStartPos, setDragStartPos] = useState<Record<string, { x: number; y: number }>>({});

  // 键盘快捷键处理：Cmd/Ctrl+C 复制，Cmd/Ctrl+V 粘贴
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入框或文本域中，不处理快捷键
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // 检查是否有文本被选中
      const selection = window.getSelection();
      const hasTextSelected = selection && selection.toString().trim().length > 0;

      // Cmd/Ctrl + C: 复制节点（仅在没有选中文本时）
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        if (hasTextSelected) {
          // 有文本被选中，让浏览器处理默认的复制行为
          return;
        }
        e.preventDefault();
        copyNode();
        // 埋点：复制快捷键
        trackKeyboardShortcut('Cmd+C', 'copy_node');
      }

      // Cmd/Ctrl + V: 粘贴节点
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        pasteNode();
        // 埋点：粘贴快捷键
        trackKeyboardShortcut('Cmd+V', 'paste_node');
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [copyNode, pasteNode]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type as NodeKind, pos);
    },
    [screenToFlowPosition, addNode]
  );

  // 节点拖拽开始
  const handleNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    const pos = { x: node.position.x, y: node.position.y };
    setDragStartPos(prev => ({ ...prev, [node.id]: pos }));
    trackNodeDragStart(node.id, node.type || 'unknown');
  }, []);

  // 节点拖拽结束
  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    const startPos = dragStartPos[node.id];
    if (startPos) {
      trackNodeDragEnd(
        node.id, 
        node.type || 'unknown',
        startPos,
        { x: node.position.x, y: node.position.y }
      );
      setDragStartPos(prev => {
        const newPositions = { ...prev };
        delete newPositions[node.id];
        return newPositions;
      });
    }
  }, [dragStartPos]);

  // 画布点击（空白区域）
  const handlePaneClick = useCallback((event: React.MouseEvent | MouseEvent) => {
    // 检查是否点击的是空白区域（不是节点）
    if (event.target === event.currentTarget) {
      trackCanvasClick();
    }
    setSelectedNode(null);
  }, [setSelectedNode]);

  // 画布右键菜单
  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    trackCanvasContextMenu({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    // 这里可以添加画布右键菜单的逻辑
  }, []);

  // 节点右键菜单
  const handleNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node: Node) => {
    event.preventDefault();
    trackNodeContextMenu(node.id, node.type || 'unknown');
    // 这里可以添加节点右键菜单的逻辑
  }, []);

  // FIX (Bug 3): Memoize defaultEdgeOptions to prevent object recreation
  // WHY: New object on every render causes ReactFlow to update all edges unnecessarily
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#E5E5E5', strokeWidth: 1.5 },
      interactionWidth: 20,
    }),
    []
  );

  return (
    <div className="flex-1 relative h-full w-full overflow-hidden bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_, node) => {
          setSelectedNode(node.id);
          // 埋点：节点选中
          trackNodeSelect(node.id, node.type || 'unknown');
        }}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        onMoveEnd={(_, viewport) => {
          // 埋点：画布移动/缩放（trackingService 内部有 5% 采样逻辑）
          trackCanvasMove(viewport.x, viewport.y, viewport.zoom);
        }}
        onSelectionChange={({ nodes, edges }) => {
          // 埋点：选中内容变更（仅在有多选时记录，避免与 onNodeClick 重复）
          if (nodes.length > 1 || edges.length > 0) {
            trackSelectionChange(nodes.length, edges.length);
          }
        }}
        fitView
        panOnScroll={interactionMode === "pan"}
        panOnDrag={interactionMode === "pan"}
        zoomOnScroll={true}
        selectionMode={interactionMode === "select" ? SelectionMode.Partial : undefined}
        selectionOnDrag={interactionMode === "select"}
        zoomOnPinch={true}
        panOnScrollMode={PanOnScrollMode.Free}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#000000"
          className="opacity-[0.05]"
        />
      </ReactFlow>
      <LLMDebugDialog />
      <RAGDebugDialog />
      <ToolDebugDialog />
      <InputDebugDialog />
      <OutputDebugDialog />

      <BranchDebugDialog />
      <ImageGenDebugDialog />
    </div>
  );
}

// FIX (Bug 3): Wrap with React.memo to prevent unnecessary re-renders
// WHY: Parent components (builder page) may re-render frequently,
// but FlowCanvas only needs to update when its props/store values change
const FlowCanvas = memo(FlowCanvasComponent);

export default FlowCanvas;

