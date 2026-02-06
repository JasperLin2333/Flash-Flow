import type { Edge, Node } from "@xyflow/react";
import type { ToolType } from "@/lib/tools/registry";

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
  // 技能配置
  enableSkills?: boolean;           // 是否启用技能调用
  skillIds?: string[];              // 允许使用的技能 id 列表
  // 高级输出配置
  responseFormat?: 'text' | 'json_object'; // 响应格式（已实现 UI）
  // 输入映射配置
  inputMappings?: {
    user_input?: string;  // 支持变量引用，如 {{输入.formData.用户输入}}
  };
}

export interface RAGNodeData extends BaseNodeData {
  // 文件模式
  fileMode?: 'variable' | 'static';  // 默认 'static'

  // 文件信息（静态模式，最多3个槽位）
  files?: { id?: string; name: string; size?: number; type?: string; url?: string }[];
  files2?: { id?: string; name: string; size?: number; type?: string; url?: string }[];
  files3?: { id?: string; name: string; size?: number; type?: string; url?: string }[];

  // Gemini File Search Store 信息
  fileSearchStoreName?: string;  // Store 名称（如 "fileSearchStores/abc123"）
  fileSearchStoreId?: string;    // Store 显示 ID（用户友好）
  uploadStatus?: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  uploadError?: string;

  // 搜索配置
  maxTokensPerChunk?: number;    // 每个块的最大 token 数，默认 200
  maxOverlapTokens?: number;     // 块之间的重叠 token 数，默认 20

  // 输入映射配置
  inputMappings?: {
    query?: string;   // 检索查询内容（如 {{输入.user_input}}）
    files?: string;   // 动态文件引用1（如 {{输入.files}}）
    files2?: string;  // 动态文件引用2
    files3?: string;  // 动态文件引用3
  };

  // 执行结果
  query?: string;                // 最后一次搜索的查询
  documents?: string[];          // 找到的文档块
  citations?: Array<{ source: string; chunk: string }>;
  documentCount?: number;
  mode?: 'multimodal' | 'fileSearch' | string;
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
  textRequired?: boolean;         // Default: false (only effective when enableTextInput !== false)
  enableFileInput?: boolean;      // Default: false
  enableStructuredForm?: boolean; // Default: false
  fileRequired?: boolean;         // Default: false (only effective when enableFileInput === true)

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
  /** 
   * @deprecated 此字段已废弃，不再用于节点配置。
   * 输出内容现通过 inputMappings 配置动态生成。
   * 
   * ⚠️ 注意：执行器输出的 flowContext[nodeId].text 是不同的字段，正常使用。
   * 详见 OutputNodeExecutor.ts 和 RunOutputs.tsx。
   */
  text?: string;
  inputMappings?: OutputInputMappings;
}

export interface ToolNodeData extends BaseNodeData {
  toolType?: ToolType; // Type-safe tool type from registry
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
  mock?: Record<string, unknown>;
}

// 扩展性调试输入数据类型（预留多模态支持）
export interface DebugInputValue {
  type: 'text' | 'image' | 'file' | 'audio'; // v1.0 只支持 text
  value: string;
}

export interface DebugInputs {
  [variableName: string]: DebugInputValue;
}

export interface ImageGenDebugInputs {
  prompt: string;
  negativePrompt?: string;
}

// ============ Unified Dialog State Types ============

export type DialogType = 'llm' | 'rag' | 'tool' | 'input' | 'output' | 'branch' | 'imagegen';

// 各类型弹窗的数据结构（用于类型安全）
export interface DialogDataMap {
  llm: DebugInputs;
  rag: DebugInputs;
  tool: Record<string, unknown>;
  input: { text?: string; files?: File[]; formData?: Record<string, unknown> };
  output: { mockVariables?: Record<string, any> };
  branch: { mockData: string };
  imagegen: ImageGenDebugInputs;
}



// ============ Agent Feed Types ============

export type FeedItemType = 'thought' | 'tool-call' | 'suggestion' | 'progress' | 'step' | 'clarification' | 'plan';

export interface BaseFeedItem {
  id: string;
  type: FeedItemType;
  timestamp: number;
}

export interface ThoughtItem extends BaseFeedItem {
  type: 'thought';
  content: string;
  isComplete: boolean;
}

export interface ToolCallItem extends BaseFeedItem {
  type: 'tool-call';
  tool: string;
  status: 'calling' | 'completed' | 'error';
  result?: unknown;
}

export interface SuggestionItem extends BaseFeedItem {
  type: 'suggestion';
  content: string;
  scenario?: string;
}

export interface StepItem extends BaseFeedItem {
  type: 'step';
  stepType: string;
  status: 'streaming' | 'completed' | 'error';
  content: string;
}

export interface ProgressItem extends BaseFeedItem {
  type: 'progress';
  content: string;
}

export interface ClarificationItem extends BaseFeedItem {
  type: 'clarification';
  questions: string[];
}

export interface PlanItem extends BaseFeedItem {
  type: 'plan';
  userPrompt: string;
  steps: string[];
  status: 'awaiting_confirm' | 'confirmed' | 'adjusting';
  // 新增：用户友好的结构化信息
  refinedIntent?: string;      // 补全后的用户意图（如"翻译"→"将文本从一种语言翻译成另一种语言"）
  workflowNodes?: {            // 工作流节点概览
    type: string;              // 节点类型 (input, llm, output, etc.)
    label: string;             // 节点名称
    description: string;       // 节点功能描述
  }[];
  useCases?: string[];         // 适用场景
  howToUse?: string[];         // 使用方法步骤
  verificationQuestions?: string[];  // 验证问题（用于迭代式规划确认）
}

export type FeedItem = ThoughtItem | ToolCallItem | SuggestionItem | ProgressItem | StepItem | ClarificationItem | PlanItem;

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
  copilotStatus: "idle" | "thinking" | "completed" | "awaiting_input" | "awaiting_plan_confirm";
  copilotMode: "classic" | "agent";
  copilotStep: number;
  copilotBackdrop: "blank" | "overlay";
  copilotFeed: FeedItem[];
  currentCopilotPrompt: string | null;

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

  // Internal execution state
  _streamingAborted?: boolean;
  _streamingError?: string;
  _executionLock?: boolean;

  // Node-level execution control (for single-node testing)
  runningNodeIds: Set<string>;  // Currently running node IDs
  nodeAbortControllers: Map<string, AbortController>;  // Per-node abort controllers

  // ============ 统一弹窗状态 (Unified Dialog State) ============
  activeDialog: DialogType | null;     // 当前打开的弹窗类型
  activeNodeId: string | null;         // 当前操作的节点 ID
  dialogData: Record<string, unknown>; // 弹窗数据 (动态类型)

  // Input Prompt 状态 (保留，因为有特殊逻辑) - DEPRECATED/REMOVED, mapped to Unified
  // inputPromptOpen: boolean;
  // inputPromptTargetNodeId: string | null;  // null = 显示所有 Input 节点

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
  startAgentCopilot: (prompt: string, options?: { enableClarification?: boolean }) => Promise<void>;  // Agent 版本 (带思维链)
  submitClarification: (originalPrompt: string, answers: string[]) => Promise<void>; // [New]
  optimizeLayout: () => void;
  setCopilotBackdrop: (b: "blank" | "overlay") => void;
  setCopilotStatus: (status: "idle" | "thinking" | "completed" | "awaiting_input" | "awaiting_plan_confirm") => void;
  confirmPlan: () => Promise<void>;
  adjustPlan: (feedback: string) => Promise<void>;
  setCopilotFeed: (feed: FeedItem[]) => void;

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

  // ============ 统一弹窗动作 (Unified Dialog Actions) ============
  openDialog: <T extends DialogType>(type: T, nodeId: string, data?: Partial<DialogDataMap[T]>) => void;
  closeDialog: () => void;
  setDialogData: (data: Record<string, unknown>) => void;
  confirmDialogRun: (extraData?: Record<string, unknown>) => Promise<void>;

  // ============ 向后兼容动作 (Deprecated - 内部使用 openDialog/closeDialog) ============
  // @deprecated - 请使用 openDialog('llm', nodeId) 代替
  openLLMDebugDialog: (nodeId: string) => void;
  closeLLMDebugDialog: () => void;
  setLLMDebugInputs: (inputs: DebugInputs) => void;
  confirmLLMDebugRun: () => Promise<void>;

  // @deprecated - 请使用 openDialog('rag', nodeId) 代替
  openRAGDebugDialog: (nodeId: string) => void;
  closeRAGDebugDialog: () => void;
  setRAGDebugInputs: (inputs: DebugInputs) => void;
  confirmRAGDebugRun: () => Promise<void>;

  // @deprecated - 请使用 openDialog('tool', nodeId) 代替
  openToolDebugDialog: (nodeId: string) => void;
  closeToolDebugDialog: () => void;
  setToolDebugInputs: (inputs: Record<string, unknown>) => void;
  confirmToolDebugRun: () => Promise<void>;

  // @deprecated - 请使用 openDialog('input', nodeId) 代替
  openInputDebugDialog: (nodeId: string) => void;
  closeInputDebugDialog: () => void;
  setInputDebugData: (data: { text?: string; files?: File[]; formData?: Record<string, unknown> }) => void;
  confirmInputDebugRun: () => Promise<void>;

  // @deprecated - 请使用 openDialog('output', nodeId) 代替
  openOutputDebugDialog: (nodeId: string) => void;
  closeOutputDebugDialog: () => void;
  setOutputDebugData: (data: { mockVariables?: Record<string, string> }) => void;
  confirmOutputDebugRun: () => Promise<void>;

  // @deprecated - 请使用 openDialog('branch', nodeId) 代替
  openBranchDebugDialog: (nodeId: string) => void;
  closeBranchDebugDialog: () => void;
  confirmBranchDebugRun: (mockData: string) => Promise<void>;

  // @deprecated - 请使用 openDialog('imagegen', nodeId) 代替
  openImageGenDebugDialog: (nodeId: string) => void;
  closeImageGenDebugDialog: () => void;
  setImageGenDebugInputs: (inputs: ImageGenDebugInputs) => void;
  confirmImageGenDebugRun: () => Promise<void>;

  // Input Prompt Actions (保留，因为有特殊逻辑)
  /** @deprecated 请使用 openDialog('input', nodeId) 代替。nodeId=undefined 表示所有 Input 节点 */
  openInputPrompt: (nodeId?: string) => void;
  /** @deprecated 请使用 closeDialog() 代替 */
  closeInputPrompt: () => void;
  /** @deprecated 请使用 confirmDialogRun() 代替 */
  confirmInputRun: () => Promise<void>;


  // Streaming Actions
  setStreamingText: (text: string) => void;
  appendStreamingText: (chunk: string) => void;
  appendStreamingReasoning: (chunk: string, sourceId?: string) => void;
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

// ============ Type Guard Utilities ============
// These functions provide type-safe access to node data based on node type

/**
 * Type guard for LLM node data
 * Use instead of `data as LLMNodeData` for safer type handling
 */
export function isLLMNode(node: AppNode): node is AppNode & { data: LLMNodeData } {
  return node.type === 'llm';
}

/**
 * Type guard for RAG node data
 */
export function isRAGNode(node: AppNode): node is AppNode & { data: RAGNodeData } {
  return node.type === 'rag';
}

/**
 * Type guard for Input node data
 */
export function isInputNode(node: AppNode): node is AppNode & { data: InputNodeData } {
  return node.type === 'input';
}

/**
 * Type guard for Output node data
 */
export function isOutputNode(node: AppNode): node is AppNode & { data: OutputNodeData } {
  return node.type === 'output';
}

/**
 * Type guard for Tool node data
 */
export function isToolNode(node: AppNode): node is AppNode & { data: ToolNodeData } {
  return node.type === 'tool';
}

/**
 * Type guard for Branch node data
 */
export function isBranchNode(node: AppNode): node is AppNode & { data: BranchNodeData } {
  return node.type === 'branch';
}

/**
 * Type guard for ImageGen node data
 */
export function isImageGenNode(node: AppNode): node is AppNode & { data: ImageGenNodeData } {
  return node.type === 'imagegen';
}

/**
 * Get typed node data based on node kind
 * Returns properly typed data or undefined if type doesn't match
 */
export function getTypedNodeData<T extends NodeKind>(
  node: AppNode,
  expectedType: T
): T extends 'llm' ? LLMNodeData :
  T extends 'rag' ? RAGNodeData :
  T extends 'input' ? InputNodeData :
  T extends 'output' ? OutputNodeData :
  T extends 'tool' ? ToolNodeData :
  T extends 'branch' ? BranchNodeData :
  T extends 'imagegen' ? ImageGenNodeData :
  AppNodeData | undefined {
  if (node.type !== expectedType) return undefined as any;
  return node.data as any;
}

/** Agent SSE Event Type */
export interface SSEEvent {
  type: string;
  content?: string;
  tool?: string;
  args?: unknown;
  result?: unknown;
  nodes?: unknown[];
  edges?: unknown[];
  warnings?: string[];
  title?: string;
  scenario?: string;
  stepType?: string;
  status?: string;
  questions?: string[];
  // Plan event fields
  steps?: string[];
  userPrompt?: string;
  refinedIntent?: string;
  workflowNodes?: { type: string; label: string; description: string }[];
  useCases?: string[];
  howToUse?: string[];
  verificationQuestions?: string[];
}
