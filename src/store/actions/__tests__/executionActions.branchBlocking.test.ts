import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AppEdge, AppNode, FlowState } from "@/types/flow";

vi.mock("@/store/executors/NodeExecutorFactory", () => ({
  NodeExecutorFactory: {
    getExecutor: () => ({
      execute: async (node: AppNode) => {
        if (node.type === "branch") {
          return { output: { conditionResult: true }, executionTime: 1 };
        }
        return { output: { nodeId: node.id }, executionTime: 1 };
      },
    }),
  },
}));

vi.mock("@/lib/trackingService", () => ({
  trackWorkflowRun: vi.fn(),
  trackWorkflowRunSuccess: vi.fn(),
  trackWorkflowRunFail: vi.fn(),
}));

let flowStoreState: any;

vi.mock("@/store/flowStore", () => ({
  useFlowStore: {
    getState: () => flowStoreState,
    setState: (updater: any) => {
      const next = typeof updater === "function" ? updater(flowStoreState) : updater;
      flowStoreState = { ...flowStoreState, ...next };
      return flowStoreState;
    },
  },
  __setFlowStoreState: (state: any) => {
    flowStoreState = state;
  },
}));

vi.mock("@/services/authService", () => ({
  authService: {
    getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
  },
}));

vi.mock("@/services/quotaService", () => ({
  quotaService: {
    checkPoints: vi.fn(async () => ({ allowed: true, balance: 10, required: 1 })),
    getLLMPointsCost: vi.fn(() => 1),
  },
}));

vi.mock("@/services/llmModelsAPI", () => ({
  llmModelsAPI: {
    getModelByModelId: vi.fn(async () => null),
  },
}));

vi.mock("@/services/llmMemoryService", () => ({
  llmMemoryService: {
    getHistory: vi.fn(async () => []),
    appendMessage: vi.fn(async () => undefined),
    trimHistory: vi.fn(async () => undefined),
  },
}));

vi.mock("@/store/quotaStore", () => ({
  useQuotaStore: {
    getState: () => ({
      refreshQuota: vi.fn(async () => undefined),
    }),
  },
}));

describe("executionActions branch blocking", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows shared downstream to run when only one upstream is blocked", async () => {
    const { createExecutionActions } = await import("@/store/actions/executionActions");
    const nodes: AppNode[] = [
      { id: "entryA", type: "tool", position: { x: 0, y: 0 }, data: { label: "Entry A" } },
      { id: "branch1", type: "branch", position: { x: 100, y: 0 }, data: { label: "Branch", condition: "true" } },
      { id: "falseNode", type: "tool", position: { x: 200, y: 0 }, data: { label: "False Path" } },
      { id: "entryB", type: "tool", position: { x: 0, y: 100 }, data: { label: "Entry B" } },
      { id: "shared", type: "tool", position: { x: 200, y: 100 }, data: { label: "Shared" } },
    ];

    const edges: AppEdge[] = [
      { id: "e1", source: "entryA", target: "branch1" },
      { id: "e2", source: "branch1", sourceHandle: "false", target: "falseNode" },
      { id: "e3", source: "falseNode", target: "shared" },
      { id: "e4", source: "entryB", target: "shared" },
    ];

    const state = {
      nodes,
      edges,
      flowContext: {},
      executionStatus: "idle",
      executionError: null,
      currentFlowId: null,
      _executionLock: false,
      runningNodeIds: new Set<string>(),
      nodeAbortControllers: new Map<string, AbortController>(),
      initSegmentedStreaming: vi.fn(),
      initSelectStreaming: vi.fn(),
      openInputPrompt: vi.fn(),
      openDialog: vi.fn(),
    } as unknown as FlowState;

    const set = (partial: ((state: FlowState) => Partial<FlowState>) | Partial<FlowState>) => {
      const next = typeof partial === "function" ? partial(state) : partial;
      Object.assign(state, next);
    };
    const get = () => state;

    const actions = createExecutionActions(set, get);
    Object.assign(state, actions);

    await state.runFlow();

    const sharedNode = state.nodes.find((node) => node.id === "shared");
    const falseNode = state.nodes.find((node) => node.id === "falseNode");

    expect(sharedNode?.data.status).toBe("completed");
    expect(falseNode?.data.status).not.toBe("completed");
    expect(state.executionStatus).toBe("completed");
  });

  it("blocks the not-taken path when branch edges are missing sourceHandle", async () => {
    const { createExecutionActions } = await import("@/store/actions/executionActions");
    const nodes: AppNode[] = [
      { id: "entry", type: "tool", position: { x: 0, y: 0 }, data: { label: "Entry" } },
      { id: "branch1", type: "branch", position: { x: 100, y: 0 }, data: { label: "Branch", condition: "true" } },
      { id: "trueNode", type: "tool", position: { x: 200, y: 0 }, data: { label: "True Path" } },
      { id: "falseNode", type: "tool", position: { x: 200, y: 120 }, data: { label: "False Path" } },
    ];

    const edges: AppEdge[] = [
      { id: "e1", source: "entry", target: "branch1" },
      { id: "e2", source: "branch1", target: "trueNode" },
      { id: "e3", source: "branch1", target: "falseNode" },
    ];

    const state = {
      nodes,
      edges,
      flowContext: {},
      executionStatus: "idle",
      executionError: null,
      currentFlowId: null,
      _executionLock: false,
      runningNodeIds: new Set<string>(),
      nodeAbortControllers: new Map<string, AbortController>(),
      initSegmentedStreaming: vi.fn(),
      initSelectStreaming: vi.fn(),
      openInputPrompt: vi.fn(),
      openDialog: vi.fn(),
    } as unknown as FlowState;

    const set = (partial: ((state: FlowState) => Partial<FlowState>) | Partial<FlowState>) => {
      const next = typeof partial === "function" ? partial(state) : partial;
      Object.assign(state, next);
    };
    const get = () => state;

    const actions = createExecutionActions(set, get);
    Object.assign(state, actions);

    await state.runFlow();

    const trueNode = state.nodes.find((node) => node.id === "trueNode");
    const falseNode = state.nodes.find((node) => node.id === "falseNode");

    expect(trueNode?.data.status).toBe("completed");
    expect(falseNode?.data.status).not.toBe("completed");
    expect(state.executionStatus).toBe("completed");
  });

  it("fails branch execution when condition expression is invalid", async () => {
    const { BranchNodeExecutor } = await import("@/store/executors/BranchNodeExecutor");
    const executor = new BranchNodeExecutor();

    const branchNode: AppNode = {
      id: "branch1",
      type: "branch",
      position: { x: 0, y: 0 },
      data: { label: "Branch", condition: "Input.user_input == 'YES'" } as any,
    };

    await expect(executor.execute(branchNode, {} as any)).rejects.toThrow(/不支持的格式/);
  });
});

describe("LLMNodeExecutor streaming error handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("clears streaming state when stream read fails", async () => {
    const { LLMNodeExecutor } = await import("@/store/executors/LLMNodeExecutor");
    const flowStore = await import("@/store/flowStore");

    const clearStreaming = vi.fn();
    const state = {
      nodes: [
        {
          id: "llm1",
          type: "llm",
          position: { x: 0, y: 0 },
          data: {
            label: "LLM",
            model: "test-model",
            systemPrompt: "",
            temperature: 0.7,
            enableMemory: false,
          },
        },
        {
          id: "output1",
          type: "output",
          position: { x: 200, y: 0 },
          data: {
            label: "Output",
            inputMappings: {
              mode: "direct",
              sources: [{ type: "variable", value: "{{llm1}}" }],
            },
          },
        },
      ],
      edges: [{ id: "e1", source: "llm1", target: "output1" }],
      flowContext: {},
      streamingText: "",
      clearStreaming,
      resetStreamingAbort: vi.fn(),
      appendStreamingText: vi.fn(),
      appendStreamingReasoning: vi.fn(),
      appendToSegment: vi.fn(),
      completeSegment: vi.fn(),
      tryLockSource: vi.fn(() => true),
      nodeAbortControllers: new Map<string, AbortController>(),
    };

    (flowStore as any).__setFlowStoreState(state);

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn(async () => {
            throw new Error("boom");
          }),
        }),
      },
    })));

    const executor = new LLMNodeExecutor();
    const result = await executor.execute(state.nodes[0] as AppNode, {} as any);

    expect(clearStreaming).toHaveBeenCalled();
    expect(result.output).toEqual({ error: "Stream read failed: boom" });
  });
});
