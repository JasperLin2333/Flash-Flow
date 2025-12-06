import type { Edge, Node } from "@xyflow/react";

export type NodeKind =
  | "input"
  | "llm"
  | "rag"
  | "output"
  | "branch"
  | "tool";

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
  // 对话记忆配置
  enableMemory?: boolean;           // 是否启用记忆，默认 false
  memoryMaxTurns?: number;          // 最大记忆轮数，默认 10
}

export interface RAGNodeData extends BaseNodeData {
  // 文件信息
  files?: { id?: string; name: string; size?: number; type?: string; url?: string }[];

  // Gemini File Search Store 信息
  fileSearchStoreName?: string;  // Store 名称（如 "fileSearchStores/abc123"）
  fileSearchStoreId?: string;    // Store 显示 ID（用户友好）
  uploadStatus?: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  uploadError?: string;

  // 搜索配置
  maxTokensPerChunk?: number;    // 每个块的最大 token 数，默认 200
  maxOverlapTokens?: number;     // 块之间的重叠 token 数，默认 20
  topK?: number;                 // 返回前 K 个最相关结果，默认 5

  // 执行结果
  searchQuery?: string;          // 最后一次搜索的查询
  foundDocuments?: string[];     // 找到的文档块
}

// ============ Input Node Form Field Types ============

export type FormFieldType = 'select' | 'text' | 'multi-select';

export interface SelectFieldConfig {
  type: 'select';
  name: string;            // Variable name (e.g., "style")
  label: string;           // Display label (e.g., "风格选择")
  options: string[];       // Dropdown options (e.g., ["严谨", "活泼", "专业"])
  required: boolean;       // Validation
  defaultValue?: string;   // Default selection
}

export interface MultiSelectFieldConfig {
  type: 'multi-select';
  name: string;
  label: string;
  options: string[];
  required: boolean;
  defaultValue?: string[];
}

export interface TextFieldConfig {
  type: 'text';
  name: string;
  label: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
}

export type FormFieldConfig = SelectFieldConfig | TextFieldConfig | MultiSelectFieldConfig;

export interface FileInputConfig {
  allowedTypes: string[];  // e.g., ['image/*', '.pdf']
  maxSizeMB: number;       // Maximum file size in MB
  maxCount: number;        // Maximum number of files
}

// ============ Input Node Data ============

export interface InputNodeData extends BaseNodeData {
  // Legacy field (backward compatibility)
  text?: string;

  // Capability toggles (Builder side configuration)
  enableTextInput?: boolean;      // Default: true
  enableFileInput?: boolean;      // Default: false
  enableStructuredForm?: boolean; // Default: false

  // Configurations (Builder side)
  fileConfig?: FileInputConfig;
  formFields?: FormFieldConfig[];

  // Runtime data (App/Runner side)
  files?: { name: string; size: number; type: string; url?: string }[];
  formData?: Record<string, unknown>;
}

export interface OutputNodeData extends BaseNodeData {
  text?: string;
}

export interface ToolNodeData extends BaseNodeData {
  toolType?: string; // e.g., "web_search" | "calculator"
  inputs?: Record<string, unknown>; // Dynamic inputs based on tool schema
}

export interface BranchNodeData extends BaseNodeData {
  condition: string; // JavaScript expression, e.g., "input.text.length > 10"
}

export type AppNodeData = BaseNodeData | LLMNodeData | RAGNodeData | InputNodeData | OutputNodeData | ToolNodeData | BranchNodeData;

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

  // Streaming state for real-time AI response
  streamingText: string;
  isStreaming: boolean;

  // LLM Debug Dialog 状态
  llmDebugDialogOpen: boolean;
  llmDebugNodeId: string | null;
  llmDebugInputs: DebugInputs;

  // RAG Debug Dialog 状态
  ragDebugDialogOpen: boolean;
  ragDebugNodeId: string | null;
  ragDebugInputs: DebugInputs;

  // Tool Debug Dialog 状态（使用简单的 key-value 格式）
  toolDebugDialogOpen: boolean;
  toolDebugNodeId: string | null;
  toolDebugInputs: Record<string, unknown>;

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
  runFlow: (sessionId?: string) => Promise<void>;
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
  organizeNodes: () => void;
  scheduleSave: () => Promise<string | null>;
  flushSave: () => Promise<string | null>;

  // Flow meta setters
  setFlowIcon: (kind?: "emoji" | "lucide" | "image", name?: string, url?: string) => void;

  // LLM Debug Actions
  openLLMDebugDialog: (nodeId: string) => void;
  closeLLMDebugDialog: () => void;
  setLLMDebugInputs: (inputs: DebugInputs) => void;
  confirmLLMDebugRun: () => Promise<void>;

  // RAG Debug Actions
  openRAGDebugDialog: (nodeId: string) => void;
  closeRAGDebugDialog: () => void;
  setRAGDebugInputs: (inputs: DebugInputs) => void;
  confirmRAGDebugRun: () => Promise<void>;

  // Tool Debug Actions
  openToolDebugDialog: (nodeId: string) => void;
  closeToolDebugDialog: () => void;
  setToolDebugInputs: (inputs: Record<string, unknown>) => void;
  confirmToolDebugRun: () => Promise<void>;

  // Input Prompt Actions
  openInputPrompt: () => void;
  closeInputPrompt: () => void;
  confirmInputRun: () => Promise<void>;

  // Streaming Actions
  setStreamingText: (text: string) => void;
  appendStreamingText: (chunk: string) => void;
  clearStreaming: () => void;
  abortStreaming: () => void;
  resetStreamingAbort: () => void;
};
