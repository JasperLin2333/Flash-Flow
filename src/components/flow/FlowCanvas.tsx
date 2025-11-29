"use client";
import { useCallback } from "react";
import { ReactFlow, Background, BackgroundVariant, useReactFlow, SelectionMode, PanOnScrollMode } from "@xyflow/react";
import { useFlowStore } from "@/store/flowStore";
import CustomNode from "./CustomNode";
import LLMDebugDialog from "./LLMDebugDialog";
import InputPromptDialog from "./InputPromptDialog";
import type { NodeKind } from "@/types/flow";

const nodeTypes = { input: CustomNode, llm: CustomNode, output: CustomNode, rag: CustomNode, http: CustomNode };

export default function FlowCanvas() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const addNode = useFlowStore((s) => s.addNode);
  const interactionMode = useFlowStore((s) => s.interactionMode);
  const { screenToFlowPosition } = useReactFlow();

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
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        fitView
        panOnScroll={interactionMode === "pan"}
        panOnDrag={interactionMode === "pan"}
        zoomOnScroll={interactionMode === "pan"}
        selectionMode={interactionMode === "select" ? SelectionMode.Partial : undefined}
        selectionOnDrag={interactionMode === "select"}
        zoomOnPinch={true}
        panOnScrollMode={PanOnScrollMode.Free}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#E5E5E5', strokeWidth: 1.5 },
        }}
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
      <InputPromptDialog />
    </div>
  );
}
