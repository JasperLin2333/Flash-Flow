"use client";
import { create } from "zustand";
import type { FlowState } from "@/types/flow";

// Import actions
import { createNodeActions } from "./actions/nodeActions";
import { createEdgeActions } from "./actions/edgeActions";
import { createExecutionActions } from "./actions/executionActions";
import { createCopilotActions } from "./actions/copilotActions";
import { createSaveActions } from "./actions/saveActions";
import { createDebugActions } from "./actions/debugActions";
import { createStreamingActions } from "./actions/streamingActions";
import { createUIActions } from "./actions/uiActions";
import { createClipboardActions } from "./actions/clipboardActions";

// Import initial state
import { INITIAL_FLOW_STATE } from "./constants/initialState";

export const useFlowStore = create<FlowState>((set, get, api) => ({
  // ===== State =====
  ...INITIAL_FLOW_STATE,

  // ===== Node Actions =====
  ...createNodeActions(set, get),

  // ===== Edge Actions =====
  ...createEdgeActions(set, get),

  // ===== Execution Actions =====
  ...createExecutionActions(set, get),

  // ===== Copilot Actions =====
  ...createCopilotActions(set, get),

  // ===== Save Actions =====
  ...createSaveActions(set, get, api),

  // ===== UI Actions =====
  ...createUIActions(set, get, api),

  // ===== Debug Actions =====
  ...createDebugActions(set, get, api),

  // ===== Streaming Actions =====
  ...createStreamingActions(set, get, api),

  // ===== Clipboard Actions =====
  ...createClipboardActions(set, get),
}));

// Export constants
export { COPILOT_STEPS } from "./constants/copilotSteps";

