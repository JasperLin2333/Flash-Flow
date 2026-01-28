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

describe("LLMNodeExecutor Basic Execution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("executes successfully in Single Mode (Direct Output)", async () => {
    const appendStreamingText = vi.fn((text) => {
        flowStoreState.streamingText += text;
    });
    
    const clearStreaming = vi.fn();
    const resetStreamingAbort = vi.fn();

    const state = {
      nodes: [
        { id: "nodeA", type: "llm", data: { model: "modelA" } },
        { 
            id: "output", 
            type: "output", 
            data: { 
                inputMappings: { 
                    mode: "direct", 
                    sources: [{ type: "variable", value: "{{nodeA}}" }] 
                } 
            } 
        }
      ],
      edges: [
        { id: "e1", source: "nodeA", target: "output" }
      ],
      flowContext: {},
      streamingText: "",
      _streamingAborted: false,
      appendStreamingText,
      clearStreaming,
      resetStreamingAbort,
      nodeAbortControllers: new Map(),
    };

    // @ts-ignore
    import("@/store/flowStore").then(mod => mod.__setFlowStoreState(state));
    flowStoreState = state;

    const executor = new LLMNodeExecutor();
    
    // Mock fetch
    const read = vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content": "Hello"}\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined });
        
    vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        body: { getReader: () => ({ read: read }) }
    })));

    const result = await executor.execute({ id: "nodeA", type: "llm", data: { model: "modelA" } } as any, {} as any);

    // Verify
    expect(result.output.response).toBe("Hello");
    expect(appendStreamingText).toHaveBeenCalled();
  });
});
