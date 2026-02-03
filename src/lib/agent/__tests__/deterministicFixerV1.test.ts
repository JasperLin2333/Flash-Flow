import { describe, it, expect } from "vitest";
import { deterministicFixWorkflowV1 } from "@/lib/agent/deterministicFixerV1";

describe("deterministicFixWorkflowV1", () => {
  it("should not auto-add Input/Output when includeInputOutput is false", () => {
    const nodes = [{ id: "n1", type: "llm", data: { label: "LLM", model: "m", systemPrompt: "hi" } }];
    const edges: any[] = [];
    const res = deterministicFixWorkflowV1(nodes, edges, { includeInputOutput: false });
    expect(res.nodes.some((n: any) => n.type === "input")).toBe(false);
    expect(res.nodes.some((n: any) => n.type === "output")).toBe(false);
  });

  it("should add Input/Output deterministically and ensure new edges have id", () => {
    const nodes = [{ id: "n1", type: "llm", data: { label: "LLM", model: "m", systemPrompt: "hi" } }];
    const edges: any[] = [];
    const res = deterministicFixWorkflowV1(nodes, edges, { includeInputOutput: true });
    expect(res.nodes.some((n: any) => n.type === "input")).toBe(true);
    expect(res.nodes.some((n: any) => n.type === "output")).toBe(true);
    for (const e of res.edges) {
      expect(typeof (e as any).id).toBe("string");
    }
  });

  it("should not rewrite Input.text when workflow has no hard errors", () => {
    const nodes = [
      { id: "input_1", type: "input", data: { label: "用户输入" } },
      { id: "llm_1", type: "llm", data: { label: "LLM", model: "m", systemPrompt: "hello {{用户输入.text}}", inputMappings: { user_input: "{{用户输入.user_input}}" } } },
      { id: "out_1", type: "output", data: { label: "输出", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
    ];
    const edges = [
      { source: "input_1", target: "llm_1" },
      { source: "llm_1", target: "out_1" },
    ];
    const res = deterministicFixWorkflowV1(nodes, edges, { includeInputOutput: false });
    const llm = res.nodes.find((n: any) => n.id === "llm_1") as any;
    expect(String(llm?.data?.systemPrompt)).toContain("{{用户输入.text}}");
  });

  it("should delete invalid edges and dedupe edges deterministically", () => {
    const nodes = [
      { id: "a", type: "input", data: { label: "Input" } },
      { id: "b", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
    ];
    const edges = [
      { source: "a", target: "b" },
      { source: "a", target: "b" },
      { source: "missing", target: "b" },
    ];
    const res = deterministicFixWorkflowV1(nodes, edges, { includeInputOutput: false });
    expect(res.edges.length).toBe(1);
    expect((res.edges[0] as any).source).toBe("a");
    expect((res.edges[0] as any).target).toBe("b");
  });
});
