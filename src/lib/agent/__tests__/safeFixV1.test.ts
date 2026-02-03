import { describe, it, expect } from "vitest";
import { safeFixWorkflowV1 } from "@/lib/agent/safeFixV1";
import { validateGeneratedWorkflowV1_2 } from "@/lib/agent/generatedWorkflowValidatorV1";

describe("safeFixWorkflowV1", () => {
  it("should reduce hard errors for invalid edges, missing edge ids, and id-based variable prefixes", () => {
    const nodes = [
      { id: "node_1", type: "input", data: { label: "用户输入" } },
      { id: "llm_1", type: "llm", data: { label: "处理器", model: "m", systemPrompt: "read {{node_1.text}}", temperature: 0.7 } },
      { id: "out_1", type: "output", data: { label: "输出", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
    ];
    const edges = [
      { source: "node_1", target: "llm_1" },
      { id: "e_bad", source: "node_1", target: "missing" },
      { source: "llm_1", target: "out_1" },
    ];

    const before = validateGeneratedWorkflowV1_2(nodes, edges);
    const fixed = safeFixWorkflowV1(nodes, edges);
    const after = validateGeneratedWorkflowV1_2(fixed.nodes, fixed.edges);

    expect(after.hardErrors.length).toBeLessThan(before.hardErrors.length);
    expect(fixed.fixes.length).toBeGreaterThan(0);
    const llm = fixed.nodes.find((n: any) => n.id === "llm_1");
    expect(llm).toBeTruthy();
    expect(String((llm as any).data.systemPrompt)).toContain("{{用户输入.user_input}}");
  });

  it("should rewrite label-based Input.text to Input.user_input deterministically", () => {
    const nodes = [
      { id: "input_1", type: "input", data: { label: "用户输入" } },
      { id: "llm_1", type: "llm", data: { label: "处理器", model: "m", systemPrompt: "read {{用户输入.text}}", temperature: 0.7 } },
      { id: "out_1", type: "output", data: { label: "输出", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
    ];
    const edges = [
      { id: "e1", source: "input_1", target: "llm_1" },
      { id: "e2", source: "llm_1", target: "out_1" },
    ];

    const fixed = safeFixWorkflowV1(nodes, edges);
    const llm = fixed.nodes.find((n: any) => n.id === "llm_1");
    expect(llm).toBeTruthy();
    expect(String((llm as any).data.systemPrompt)).toContain("{{用户输入.user_input}}");
    expect(String((llm as any).data.systemPrompt)).not.toContain("{{用户输入.text}}");
  });

  it("should normalize edge endpoints when label references are used", () => {
    const nodes = [
      { id: "n1", type: "input", data: { label: "起点" } },
      { id: "n2", type: "output", data: { label: "终点", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
    ];
    const edges = [
      { source: "起点", target: "终点" },
    ];

    const fixed = safeFixWorkflowV1(nodes, edges);
    expect(fixed.edges.length).toBe(1);
    expect((fixed.edges[0] as any).source).toBe("n1");
    expect((fixed.edges[0] as any).target).toBe("n2");
  });

  it("should rewrite branch condition Input.text and LLM.answer without template braces", () => {
    const nodes = [
      { id: "input_1", type: "input", position: { x: 0, y: 0 }, data: { label: "Input" } },
      { id: "llm_1", type: "llm", position: { x: 0, y: 80 }, data: { label: "LLM", model: "m", systemPrompt: "ok", temperature: 0.7 } },
      { id: "b1", type: "branch", position: { x: 100, y: 0 }, data: { label: "Branch", condition: 'Input.text.includes(\"error\")||LLM.answer.startsWith(\"Yes\")' } },
      { id: "out_1", type: "output", position: { x: 200, y: 0 }, data: { label: "输出", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
    ];
    const edges = [
      { id: "e1", source: "input_1", target: "b1" },
      { id: "e2", source: "llm_1", target: "b1" },
      { id: "e3", source: "b1", target: "out_1" },
    ];

    const fixed = safeFixWorkflowV1(nodes, edges);
    const branch = fixed.nodes.find((n: any) => n.id === "b1");
    expect(branch).toBeTruthy();
    expect(String((branch as any).data.condition)).toContain("Input.user_input");
    expect(String((branch as any).data.condition)).toContain("LLM.response");
    expect(String((branch as any).data.condition)).not.toContain("Input.text");
    expect(String((branch as any).data.condition)).not.toContain("LLM.answer");
  });
});
