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
    interactionMode: "select" as const,
    isAppMode: false,
    copilotStatus: "idle" as const,
    copilotStep: 0,
    copilotBackdrop: "overlay" as const,
    debugNodeId: null,
    debugModalOpen: false,
    debugMockData: "{}",
    inputPromptOpen: false,
};
