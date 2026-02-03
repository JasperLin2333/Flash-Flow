import { describe, expect, it } from "vitest";
import { sanitizeFlowForSave } from "@/store/utils/flowPersistence";
import type { AppEdge, AppNode } from "@/types/flow";

describe("sanitizeFlowForSave", () => {
  it("removes runtime fields and strips Input runtime data", () => {
    const nodes: AppNode[] = [
      {
        id: "n1",
        type: "input",
        position: { x: 0, y: 0 },
        data: {
          label: "输入",
          status: "running",
          executionTime: 123,
          output: { secret: "x" },
          text: "user text",
          files: [{ name: "a", size: 1, type: "text/plain", url: "u" }],
          formData: { a: 1 },
          enableStructuredForm: true,
          formFields: [{ type: "text", name: "a", label: "A", required: true }],
        } as any,
      } as any,
      {
        id: "n2",
        type: "llm",
        position: { x: 0, y: 0 },
        data: {
          label: "LLM",
          status: "completed",
          executionTime: 99,
          output: { response: "hi" },
          model: "x",
        } as any,
      } as any,
    ];

    const edges: AppEdge[] = [{ id: "e1", source: "n1", target: "n2" } as any];
    const result = sanitizeFlowForSave(nodes, edges);

    const inputData = result.nodes[0].data as any;
    expect(inputData.status).toBe("idle");
    expect("executionTime" in inputData).toBe(false);
    expect("output" in inputData).toBe(false);
    expect("text" in inputData).toBe(false);
    expect("files" in inputData).toBe(false);
    expect("formData" in inputData).toBe(false);

    const llmData = result.nodes[1].data as any;
    expect(llmData.status).toBe("idle");
    expect("executionTime" in llmData).toBe(false);
    expect("output" in llmData).toBe(false);
    expect(llmData.model).toBe("x");
  });
});

