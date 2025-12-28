import type { Edge, Node } from "@xyflow/react";

export type NodeKind =
  | "input"
  | "llm"
  | "rag"
  | "output"
  | "branch"
  | "tool"
  | "imagegen";

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
  // 高级输出配置
  responseFormat?: 'text' | 'json_object'; // 响应格式（已实现 UI）
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

  // 执行结果
  query?: string;                // 最后一次搜索的查询
  documents?: string[];          // 找到的文档块
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

  // 招呼语配置
  greeting?: string;  // 欢迎描述，引导用户如何使用该助手

  // Runtime data (App/Runner side)
  files?: { name: string; size: number; type: string; url?: string }[];
  formData?: Record<string, unknown>;
}

// ============ Output Node Types ============

export type OutputMode = 'direct' | 'select' | 'merge' | 'template';

export interface ContentSource {
  type: 'variable' | 'static';
  value: string;
  label?: string;
}

export interface AttachmentSource {
  type: 'variable' | 'static';
  value: string;
}

export interface OutputInputMappings {
  mode: OutputMode;
  sources?: ContentSource[];
  template?: string;
  attachments?: AttachmentSource[];
}

export interface OutputNodeData extends BaseNodeData {
  text?: string;
  inputMappings?: OutputInputMappings;
}

export interface ToolNodeData extends BaseNodeData {
  toolType?: string; // e.g., "web_search" | "calculator"
  inputs?: Record<string, unknown>; // Dynamic inputs based on tool schema
}

export interface BranchNodeData extends BaseNodeData {
  condition: string; // JavaScript expression, e.g., "input.text.length > 10"
}

// ============ ImageGen Node Types ============

export interface ImageGenNodeData extends BaseNodeData {
  model?: string;           // "black-forest-labs/FLUX.1-schnell" | "Kwai-Kolors/Kolors"
  prompt: string;           // 支持 {{变量}} 语法
  negativePrompt?: string;  // 负向提示词 (仅部分模型支持)
  imageSize?: string;       // "1024x1024" | "512x1024" | "1024x512" 等
  cfg?: number;             // 统一 CFG 值 (前端使用，后端根据 cfgParam 转换)
  // 新增字段 - 动态显示
  guidanceScale?: number;        // 引导系数 (CFG)，仅 Kolors/SD 模型支持 (兼容旧数据)
  numInferenceSteps?: number;    // 推理步数

  // 参考图配置 (图生图)
  referenceImageMode?: 'variable' | 'static';  // 默认 'static'
  referenceImageUrl?: string;                   // 静态上传 URL
  referenceImageUrl2?: string;                  // 静态上传 URL 2
  referenceImageUrl3?: string;                  // 静态上传 URL 3
  referenceImageVariable?: string;              // 变量引用 image ({{xx.imageUrl}})
  referenceImage2Variable?: string;             // 变量引用 image2 (仅 Edit-2509)
  referenceImage3Variable?: string;             // 变量引用 image3 (仅 Edit-2509)
}

export type AppNodeData = BaseNodeData | LLMNodeData | RAGNodeData | InputNodeData | OutputNodeData | ToolNodeData | BranchNodeData | ImageGenNodeData;

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

/** 流程执行元数据 */
export interface FlowContextMeta {
  flowId?: string | null;
  sessionId?: string;
  nodeLabels?: Record<string, string>;
}

export interface FlowContext {
  [nodeId: string]: Record<string, unknown> | FlowContextMeta | undefined;
  _meta?: FlowContextMeta;
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
  streamingReasoning: string;
  isStreaming: boolean;
  isStreamingReasoning: boolean;

  // Segment streaming state (for merge mode)
  streamingMode: 'single' | 'segmented' | 'select';
  streamingSegments: { sourceId: string; content: string; status: 'waiting' | 'streaming' | 'completed' | 'error' }[];

  // Select mode state (first-char-lock)
  lockedSourceId: string | null;
  selectSourceIds: string[];

  // Internal execution lock
  _executionLock?: boolean;

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

  // Input Debug Dialog 状态
  inputDebugDialogOpen: boolean;
  inputDebugNodeId: string | null;
  inputDebugData: { text?: string; files?: File[]; formData?: Record<string, unknown> };

  // Output Debug Dialog 状态
  outputDebugDialogOpen: boolean;
  outputDebugNodeId: string | null;
  outputDebugData: { mockVariables?: Record<string, string> };

  // Input Prompt 状态
  inputPromptOpen: boolean;
  inputPromptTargetNodeId: string | null;  // null = 显示所有 Input 节点

  // Node Actions
  addNode: (type: NodeKind, position: { x: number; y: number }, data?: Partial<AppNodeData>) => void;
  updateNodeData: (id: string, data: Partial<AppNodeData>) => void;
  resetNodeData: (id: string) => void;
  setSelectedNode: (id: string | null) => void;

  // Clipboard Actions
  clipboard: AppNode | null;
  copyNode: () => void;
  pasteNode: () => void;

  // Edge Actions
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: any) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;

  // Execution Actions
  runFlow: (sessionId?: string) => Promise<void>;
  runNode: (id: string, mockInputData?: Record<string, unknown>) => Promise<void>;
  resetExecution: (clearInputs?: boolean) => void;

  // Copilot Actions
  startCopilot: (prompt: string) => Promise<void>;
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

  // Input Debug Actions
  openInputDebugDialog: (nodeId: string) => void;
  closeInputDebugDialog: () => void;
  setInputDebugData: (data: { text?: string; files?: File[]; formData?: Record<string, unknown> }) => void;
  confirmInputDebugRun: () => Promise<void>;

  // Output Debug Actions
  openOutputDebugDialog: (nodeId: string) => void;
  closeOutputDebugDialog: () => void;
  setOutputDebugData: (data: { mockVariables?: Record<string, string> }) => void;
  confirmOutputDebugRun: () => Promise<void>;

  // Input Prompt Actions
  openInputPrompt: (nodeId?: string) => void;  // nodeId=undefined 表示所有 Input 节点
  closeInputPrompt: () => void;
  confirmInputRun: () => Promise<void>;

  // Streaming Actions
  setStreamingText: (text: string) => void;
  appendStreamingText: (chunk: string) => void;
  appendStreamingReasoning: (chunk: string) => void;
  clearStreaming: () => void;
  abortStreaming: () => void;
  resetStreamingAbort: () => void;

  // Segment Streaming Actions (merge mode)
  initSegmentedStreaming: (sourceIds: string[]) => void;
  appendToSegment: (sourceId: string, chunk: string) => void;
  completeSegment: (sourceId: string) => void;
  failSegment: (sourceId: string, error: string) => void;

  // Select Streaming Actions (first-char-lock)
  initSelectStreaming: (sourceIds: string[]) => void;
  tryLockSource: (sourceId: string) => boolean;
};
