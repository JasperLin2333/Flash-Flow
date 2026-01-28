import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMNodeExecutor } from "../LLMNodeExecutor";

// Mock store
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

// Mock services
vi.mock("@/services/authService", () => ({
  authService: { getCurrentUser: vi.fn(async () => ({ id: "user-1" })) },
}));
vi.mock("@/services/quotaService", () => ({
  quotaService: { 
    checkPoints: vi.fn(async () => ({ allowed: true })),
    getLLMPointsCost: vi.fn(() => 1) 
  },
}));
vi.mock("@/services/llmModelsAPI", () => ({
  llmModelsAPI: { getModelByModelId: vi.fn(async () => null) },
}));
vi.mock("@/services/llmMemoryService", () => ({
  llmMemoryService: { getHistory: vi.fn(async () => []) },
}));
vi.mock("@/store/quotaStore", () => ({
  useQuotaStore: { getState: () => ({ refreshQuota: vi.fn() }) },
}));

describe("LLMNodeExecutor Segmented Mode (Merge Output)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("correctly appends content to specific segment in Merge Mode", async () => {
    // Setup store with Segmented Mode logic matching streamingActions.ts
    const appendToSegment = vi.fn((sourceId, chunk) => {
        if (flowStoreState._streamingAborted) return;
        
        const segments = flowStoreState.streamingSegments || [];
        const index = segments.findIndex((s: any) => s.sourceId === sourceId);
        if (index === -1) return;

        segments[index].content += chunk;
        segments[index].status = 'streaming';
        
        // Update combined text (simplified logic for test)
        flowStoreState.streamingText = segments.map((s: any) => s.content).join("\n\n");
    });

    const failSegment = vi.fn((sourceId, error) => {
        const segments = flowStoreState.streamingSegments || [];
        const index = segments.findIndex((s: any) => s.sourceId === sourceId);
        if (index !== -1) {
            segments[index].status = 'error';
        }
    });

    const resetStreamingAbort = vi.fn(() => {
        flowStoreState._streamingAborted = false;
    });

    // Initial State: 2 segments waiting
    const state = {
      nodes: [
        { id: "nodeA", type: "llm", data: { model: "modelA" } },
        { id: "nodeB", type: "llm", data: { model: "modelB" } },
        { 
            id: "output", 
            type: "output", 
            data: { 
                inputMappings: { 
                    mode: "merge", 
                    sources: [{ type: "variable", value: "{{nodeA}}" }, { type: "variable", value: "{{nodeB}}" }] 
                } 
            } 
        }
      ],
      edges: [
        { id: "e1", source: "nodeA", target: "output" },
        { id: "e2", source: "nodeB", target: "output" }
      ],
      flowContext: {},
      streamingText: "",
      streamingReasoning: "",
      streamingMode: 'segmented',
      streamingSegments: [
          { sourceId: "nodeA", content: "", status: "streaming" },
          { sourceId: "nodeB", content: "", status: "waiting" }
      ],
      _streamingAborted: false,
      appendToSegment,
      failSegment,
      resetStreamingAbort,
      nodeAbortControllers: new Map(),
      // Mocks for other methods
      appendStreamingText: vi.fn(),
      clearStreaming: vi.fn(),
      abortStreaming: vi.fn(),
      tryLockSource: vi.fn(),
      completeSegment: vi.fn(),
    };

    // @ts-ignore
    import("@/store/flowStore").then(mod => mod.__setFlowStoreState(state));
    flowStoreState = state;

    const executorA = new LLMNodeExecutor();
    
    // Mock fetch for Node A
    const readA = vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content": "ContentA"}\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined });
        
    vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        body: { getReader: () => ({ read: readA }) }
    })));

    // Execute Node A
    await executorA.execute({ id: "nodeA", type: "llm", data: { model: "modelA" } } as any, {} as any);

    // Verify:
    // 1. appendToSegment called with correct ID
    expect(appendToSegment).toHaveBeenCalledWith("nodeA", "C");
    expect(appendToSegment).toHaveBeenCalledWith("nodeA", "o");
    
    // 2. Segment content updated (via mock implementation)
    expect(flowStoreState.streamingSegments[0].content).toContain("ContentA");
    expect(flowStoreState.streamingSegments[1].content).toBe(""); // Node B untouched
  });
});
