import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMNodeExecutor } from "../LLMNodeExecutor";
import type { AppNode } from "@/types/flow";

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

describe("LLMNodeExecutor Select Mode Race Condition", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prevents second node from taking over with partial content when locked node fails", async () => {
    // Setup store with Select Mode logic matching streamingActions.ts
    const appendStreamingText = vi.fn((text) => {
        if (flowStoreState._streamingAborted) return; // Logic from streamingActions.ts
        flowStoreState.streamingText += text;
        flowStoreState.isStreaming = true;
    });
    
    const clearStreaming = vi.fn(() => {
        flowStoreState.streamingText = "";
        flowStoreState.isStreaming = false;
        flowStoreState.streamingMode = 'single';
        flowStoreState.lockedSourceId = null;
        flowStoreState.selectSourceIds = [];
    });
    
    const abortStreaming = vi.fn(() => {
        flowStoreState.streamingText = "";
        flowStoreState.isStreaming = false;
        flowStoreState._streamingAborted = true; // Key change
        flowStoreState.streamingMode = 'single';
        flowStoreState.lockedSourceId = null;
    });

    const failSegment = vi.fn();

    const tryLockSource = vi.fn((sourceId) => {
        if (flowStoreState.lockedSourceId && flowStoreState.lockedSourceId !== sourceId) return false;
        if (flowStoreState.selectSourceIds.length > 0 && !flowStoreState.selectSourceIds.includes(sourceId)) return false;
        flowStoreState.lockedSourceId = sourceId;
        return true;
    });

    const resetStreamingAbort = vi.fn(() => {
        flowStoreState._streamingAborted = false;
    });

    const state = {
      nodes: [
        { id: "nodeA", type: "llm", data: { model: "modelA" } },
        { id: "nodeB", type: "llm", data: { model: "modelB" } },
        { 
            id: "output", 
            type: "output", 
            data: { 
                inputMappings: { 
                    mode: "select", 
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
      streamingMode: 'single', 
      lockedSourceId: null,
      selectSourceIds: [],
      _streamingAborted: false,
      appendStreamingText,
      clearStreaming,
      abortStreaming,
      failSegment,
      tryLockSource,
      resetStreamingAbort,
      appendStreamingReasoning: vi.fn(),
      nodeAbortControllers: new Map(),
    };
    
    // @ts-expect-error test store mock typing
    import("@/store/flowStore").then(mod => mod.__setFlowStoreState(state));
    flowStoreState = state;

    // 1. Set Select Mode
    flowStoreState.streamingMode = 'select';
    flowStoreState.selectSourceIds = ['nodeA', 'nodeB'];

    // 2. Node A runs, locks, streams, then fails.
    const executorA = new LLMNodeExecutor();
    
    // Mock fetch for A - handle up to 3 attempts (1 initial + 2 retries)
    const readA = vi.fn()
        // Attempt 1
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content": "PartA"}\n\n') })
        .mockRejectedValueOnce(new Error("FailA"))
        // Attempt 2
        .mockRejectedValueOnce(new Error("FailA"))
        // Attempt 3
        .mockRejectedValueOnce(new Error("FailA"));
        
    vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        body: { getReader: () => ({ read: readA }) }
    })));

    // Run A
    const resultA = await executorA.execute(state.nodes[0] as AppNode, {} as any);
    
    // Check state after A fails
    expect(resultA.output).toEqual({ error: "Stream read failed: FailA" });
    
    // VERIFY FIX:
    expect(abortStreaming).toHaveBeenCalled(); // Should call abortStreaming instead of clearStreaming
    expect(flowStoreState._streamingAborted).toBe(true);
    
    // 3. Simulate Node B trying to write
    const executorB = new LLMNodeExecutor();
    // @ts-expect-error access private method for test
    executorB.flushBuffer("PartB", "select", "nodeB", flowStoreState);
    
    // Assert: Node B should NOT be able to write because _streamingAborted is true
    expect(flowStoreState.streamingText).not.toContain("PartB");
    expect(flowStoreState.streamingText).toBe(""); // Text should be cleared by abortStreaming
    expect(flowStoreState._streamingAborted).toBe(true);
  });

  it("respects lock for reasoning in Select Mode", async () => {
    const appendStreamingReasoning = vi.fn((chunk, sourceId) => {
         if (flowStoreState._streamingAborted) return;
         
         if (flowStoreState.streamingMode === 'select' && sourceId) {
             const { lockedSourceId, selectSourceIds } = flowStoreState;
             if (lockedSourceId && lockedSourceId !== sourceId) return;
             if (!lockedSourceId && selectSourceIds.includes(sourceId)) {
                 flowStoreState.lockedSourceId = sourceId;
             }
         }
         flowStoreState.streamingReasoning = (flowStoreState.streamingReasoning || "") + chunk;
    });

    const state = {
      nodes: [
        { id: "nodeA", type: "llm", data: { model: "modelA" } },
        { id: "nodeB", type: "llm", data: { model: "modelB" } },
        { 
            id: "output", 
            type: "output", 
            data: { 
                inputMappings: { 
                    mode: "select", 
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
      streamingMode: 'select', 
      lockedSourceId: 'nodeA', // Node A has already locked the stream
      selectSourceIds: ['nodeA', 'nodeB'],
      _streamingAborted: false,
      appendStreamingReasoning,
      nodeAbortControllers: new Map(),
      // Mocks for other methods to prevent crashes
      appendStreamingText: vi.fn(),
      clearStreaming: vi.fn(),
      abortStreaming: vi.fn(),
      tryLockSource: vi.fn(),
      resetStreamingAbort: vi.fn(),
      appendToSegment: vi.fn(),
      completeSegment: vi.fn(),
    };

    // @ts-expect-error test store mock typing
    import("@/store/flowStore").then(mod => mod.__setFlowStoreState(state));
    flowStoreState = state;

    const executorB = new LLMNodeExecutor();
    
    // Mock fetch for B sending reasoning
    const readB = vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"reasoning": "ReasonB"}\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined });
        
    vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        body: { getReader: () => ({ read: readB }) }
    })));

    // Execute Node B
     const result = await executorB.execute({ id: "nodeB", type: "llm", data: { model: "modelB" } } as any, {} as any);
     if (result.output.error) {
         console.error("Execution error:", result.output.error);
     }

     // Verify:
    // 1. LLMNodeExecutor correctly passed node ID
    expect(appendStreamingReasoning).toHaveBeenCalledWith("ReasonB", "nodeB");
    
    // 2. The reasoning was NOT appended because Node A held the lock
    expect(flowStoreState.streamingReasoning).toBe("");
  });

  it("does not abort streaming if a non-locked node fails in select mode", async () => {
    const abortStreaming = vi.fn();

    const state = {
      nodes: [
        { id: "nodeA", type: "llm", data: { model: "modelA" } },
        { id: "nodeB", type: "llm", data: { model: "modelB" } },
        { 
            id: "output", 
            type: "output", 
            data: { 
                inputMappings: { 
                    mode: "select", 
                    sources: [{ type: "variable", value: "{{nodeA}}" }, { type: "variable", value: "{{nodeB}}" }] 
                } 
            } 
        }
      ],
      edges: [],
      flowContext: {},
      streamingMode: "select",
      selectSourceIds: ["nodeA", "nodeB"],
      lockedSourceId: "nodeA", // Locked to A
      _streamingAborted: false,
      abortStreaming,
      
      // Other required mocks
      appendStreamingText: vi.fn(),
      clearStreaming: vi.fn(),
      failSegment: vi.fn(),
      tryLockSource: vi.fn(),
      resetStreamingAbort: vi.fn(),
      appendToSegment: vi.fn(),
      completeSegment: vi.fn(),
      appendStreamingReasoning: vi.fn(),
      nodeAbortControllers: new Map(),
    };

    // @ts-expect-error test store mock typing
    import("@/store/flowStore").then(mod => mod.__setFlowStoreState(state));
    flowStoreState = state;

    const executorB = new LLMNodeExecutor();
    
    // Mock fetch to fail
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("API Error")));

    // Execute Node B
    const result = await executorB.execute({ id: "nodeB", type: "llm", data: { model: "modelB" } } as any, {} as any);

    // Verify
    expect(result.output.error).toContain("API Error");
    expect(abortStreaming).not.toHaveBeenCalled();
  });
});
