import type { AppNode, AppEdge } from "@/types/flow";

// FIX: Start from blank canvas instead of pre-populated nodes
// Users can either use AI to generate flows or manually add nodes
export const initialNodes: AppNode[] = [];

export const initialEdges: AppEdge[] = [];

export const INITIAL_FLOW_STATE = {
    nodes: initialNodes,
    edges: initialEdges,
    selectedNodeId: null,  // FIX: No pre-selected node on blank canvas
    saveStatus: "saved" as const,
    flowTitle: "Untitled Flow",  // FIX: Generic title for new flows
    flowIconKind: undefined as undefined,
    flowIconName: undefined as undefined,
    flowIconUrl: undefined as undefined,
    currentFlowId: null,
    executionStatus: "idle" as const,
    executionError: null,
    flowContext: {},
    interactionMode: "pan" as const,
    isAppMode: false,
    copilotStatus: "idle" as const,
    copilotStep: 0,
    copilotBackdrop: "overlay" as const,

    // LLM Debug Dialog 初始状态
    llmDebugDialogOpen: false,
    llmDebugNodeId: null,
    llmDebugInputs: {},

    // RAG Debug Dialog
    ragDebugDialogOpen: false,
    ragDebugNodeId: null,
    ragDebugInputs: {},

    // Tool Debug Dialog
    toolDebugDialogOpen: false,
    toolDebugNodeId: null,
    toolDebugInputs: {},

    // Input Debug Dialog
    inputDebugDialogOpen: false,
    inputDebugNodeId: null,
    inputDebugData: { text: '', files: [], formData: {} },

    // Output Debug Dialog
    outputDebugDialogOpen: false,
    outputDebugNodeId: null,
    outputDebugData: { mockVariables: {} },

    inputPromptOpen: false,
    inputPromptTargetNodeId: null,  // null = 显示所有 Input 节点

    // Clipboard state for copy/paste
    clipboard: null,

    // Streaming state
    streamingText: "",
    streamingReasoning: "",
    isStreaming: false,
    isStreamingReasoning: false,
    _streamingAborted: false,

    // Segment streaming (merge mode)
    streamingMode: "single" as const,
    streamingSegments: [] as { sourceId: string; content: string; status: 'waiting' | 'streaming' | 'completed' | 'error' }[],

    // Select mode (first-char-lock)
    lockedSourceId: null as string | null,
    selectSourceIds: [] as string[],

    // 执行锁（内部使用，防止并发执行）
    _executionLock: false,
};
