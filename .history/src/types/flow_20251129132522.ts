import type { Edge, Node } from "@xyflow/react";

export type NodeKind =
  | "input"
  | "llm"
  | "rag"
  | "output"
  | "branch"
  | "http";

export type ExecutionStatus = "idle" | "running" | "completed" | "error";

export interface BaseNodeData {
  label?: string;
  status?: ExecutionStatus;
  executionTime?: number;
  output?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LLMNodeData extends BaseNodeData {
  model: string;
  systemPrompt: string;
  temperature: number;
}

export interface RAGNodeData extends BaseNodeData {
  files?: { id?: string; name: string; size?: number; type?: string; url?: string }[];
}

export interface InputNodeData extends BaseNodeData {
  text?: string;
}

export interface OutputNodeData extends BaseNodeData {
  text?: string;
}

export interface HttpNodeData extends BaseNodeData {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url?: string;
}

export type AppNodeData = BaseNodeData | LLMNodeData | RAGNodeData | InputNodeData | OutputNodeData | HttpNodeData;

export type AppNode = Node<AppNodeData> & { type: NodeKind }; // Made type required
export type AppEdge = Edge & {
  label?: string;
  animated?: boolean;
  style?: React.CSSProperties;
};

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowData {
  nodes: AppNode[];
  edges: AppEdge[];
  viewport?: Viewport;
}

export interface FlowRecord {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  icon_kind?: "emoji" | "lucide" | "image";
  icon_name?: string;
  icon_url?: string;
  node_count?: number;
  data: FlowData;
  created_at: string;
  updated_at: string;
}

export interface FlowContext {
  [nodeId: string]: Record<string, unknown>;
}

// 扩展性调试输入数据类型（预留多模态支持）
export interface DebugInputValue {
  type: 'text' | 'image' | 'file' | 'audio'; // v1.0 只支持 text
  value: string;
}

export interface DebugInputs {
  [variableName: string]: DebugInputValue;
}


// Complete FlowStore State Type
export type FlowState = {
  // State
  nodes: AppNode[];
  edges: AppEdge[];
  selectedNodeId: string | null;
  saveStatus: "saved" | "saving";
  flowTitle: string;
  flowIconKind?: "emoji" | "lucide" | "image";
  flowIconName?: string;
  flowIconUrl?: string;
  currentFlowId: string | null;
  executionStatus: ExecutionStatus;
  executionError: string | null;
  flowContext: FlowContext;
  interactionMode: "select" | "pan";
  isAppMode: boolean;
  copilotStatus: "idle" | "thinking" | "completed";
  copilotStep: number;
  copilotBackdrop: "blank" | "overlay";

  // LLM Debug Dialog 状态
  llmDebugDialogOpen: boolean;
  llmDebugNodeId: string | null;
  llmDebugInputs: DebugInputs;

  // Input Prompt 状态
  inputPromptOpen: boolean;

  // Node Actions
  addNode: (type: NodeKind, position: { x: number; y: number }, data?: Partial<AppNodeData>) => void;
  updateNodeData: (id: string, data: Partial<AppNodeData>) => void;
  resetNodeData: (id: string) => void;
  setSelectedNode: (id: string | null) => void;

  // Edge Actions
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: any) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;

  // Execution Actions
  runFlow: () => Promise<void>;
  runNode: (id: string, mockInputData?: Record<string, unknown>) => Promise<void>;
  resetExecution: () => void;

  // Copilot Actions
  startCopilot: (prompt: string) => Promise<void>;
  generateFlowFromPrompt: (prompt: string) => Promise<void>;
  optimizeLayout: () => void;
  setCopilotBackdrop: (b: "blank" | "overlay") => void;
  setCopilotStatus: (status: "idle" | "thinking" | "completed") => void;

  // Simple Setters
  setFlowTitle: (title: string) => void;
  setCurrentFlowId: (id: string | null) => void;
  setInteractionMode: (mode: "select" | "pan") => void;
  setAppMode: (isAppMode: boolean) => void;
  scheduleSave: () => Promise<void>;

  // Flow meta setters
  setFlowIcon: (kind?: "emoji" | "lucide" | "image", name?: string, url?: string) => void;

  // LLM Debug Actions
  openLLMDebugDialog: (nodeId: string) => void;
  closeLLMDebugDialog: () => void;
  setLLMDebugInputs: (inputs: DebugInputs) => void;
  confirmLLMDebugRun: () => Promise<void>;

  // Input Prompt Actions
  openInputPrompt: () => void;
  closeInputPrompt: () => void;
  confirmInputRun: () => Promise<void>;
};
