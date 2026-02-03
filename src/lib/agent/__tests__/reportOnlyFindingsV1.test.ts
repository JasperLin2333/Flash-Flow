import { describe, it, expect } from "vitest";
import { healStructure } from "@/lib/agent/structureHealer";
import { healVariables } from "@/lib/agent/variableHealer";

describe("report-only healers", () => {
  it("healStructure should not mutate edges or nodes", () => {
    const nodes = [
      { id: "1", type: "input", data: { label: "Input" } },
      { id: "2", type: "llm", data: { label: "LLM" } },
      { id: "3", type: "output", data: { label: "Output" } },
    ];
    const edges = [
      { source: "1", target: "2" },
      { source: "2", target: "1" },
      { source: "2", target: "3" },
      { source: "2", target: "3" },
      { source: "missing", target: "3" },
    ];

    const res = healStructure(nodes as any[], edges as any[]);
    expect(JSON.stringify(res.fixedNodes)).toBe(JSON.stringify(nodes));
    expect(JSON.stringify(res.fixedEdges)).toBe(JSON.stringify(edges));
    expect(res.fixes.length).toBeGreaterThan(0);
  });

  it("healVariables should not rewrite prompts, only provide suggestions", () => {
    const nodes = [
      { id: "node_1", type: "input", data: { label: "UserQuery" } },
      { id: "node_2", type: "llm", data: { label: "LLM", prompt: "Hello {{node_1.text}}" } },
      { id: "node_3", type: "output", data: { label: "Output" } },
    ];
    const res = healVariables(nodes as any[]);
    expect(JSON.stringify(res.fixedNodes)).toBe(JSON.stringify(nodes));
    expect(res.fixes.some((x) => x.includes("Suggest replacing"))).toBe(true);
  });
});

