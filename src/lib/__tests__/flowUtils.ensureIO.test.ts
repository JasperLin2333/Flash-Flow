import { describe, it, expect } from "vitest";
import { ensureInputOutputNodesAndEdges } from "../flowUtils";

describe("ensureInputOutputNodesAndEdges", () => {
  it("adds Output with minimal runnable inputMappings", () => {
    const rawNodes: any[] = [
      { id: "input_1", type: "input", data: { label: "用户输入" } },
      { id: "llm_1", type: "llm", data: { label: "AI" } },
    ];
    const rawEdges: any[] = [{ source: "input_1", target: "llm_1" }];

    const { nodes } = ensureInputOutputNodesAndEdges(rawNodes, rawEdges);
    const out = nodes.find((n: any) => n.type === "output");
    expect(out).toBeTruthy();
    expect(out.data?.inputMappings?.mode).toBe("select");
    expect(out.data?.inputMappings?.sources?.[0]?.value).toBe("{{llm_1.response}}");
  });
});

