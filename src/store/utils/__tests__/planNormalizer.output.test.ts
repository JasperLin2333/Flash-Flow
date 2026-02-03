import { describe, it, expect } from "vitest";
import { normalizePlan } from "../planNormalizer";
import type { AppNode, OutputNodeData } from "@/types/flow";

describe("normalizePlan Output inputMappings", () => {
  it("preserves structured inputMappings", () => {
    const plan: any = {
      nodes: [
        {
          id: "out_1",
          type: "output",
          data: {
            label: "最终输出",
            inputMappings: {
              mode: "merge",
              sources: [{ type: "variable", value: "{{llm_1.response}}" }],
              attachments: [{ type: "static", value: "https://example.com/a.png" }],
            },
          },
        },
      ],
      edges: [],
    };

    const { nodes } = normalizePlan(plan, "");
    const out = nodes.find(
      (n): n is AppNode & { type: "output"; data: OutputNodeData } => n.type === "output"
    );
    if (!out) throw new Error("Expected output node to exist");
    if (!out.data.inputMappings) throw new Error("Expected output.inputMappings to be normalized");

    expect(out.data.inputMappings.mode).toBe("merge");
    expect(out.data.inputMappings.sources?.[0]?.value).toBe("{{llm_1.response}}");
    expect(out.data.inputMappings.attachments?.[0]?.type).toBe("static");
  });

  it("normalizes string sources to array", () => {
    const plan: any = {
      nodes: [
        {
          id: "out_1",
          type: "output",
          data: {
            label: "最终输出",
            inputMappings: {
              mode: "direct",
              sources: "{{llm_1.response}}",
            },
          },
        },
      ],
      edges: [],
    };

    const { nodes } = normalizePlan(plan, "");
    const out = nodes.find(
      (n): n is AppNode & { type: "output"; data: OutputNodeData } => n.type === "output"
    );
    if (!out) throw new Error("Expected output node to exist");
    if (!out.data.inputMappings) throw new Error("Expected output.inputMappings to be normalized");

    expect(out.data.inputMappings.sources).toHaveLength(1);
    expect(out.data.inputMappings.sources?.[0]).toMatchObject({
      type: "variable",
      value: "{{llm_1.response}}",
    });
  });

  it("falls back to safe default when missing inputMappings", () => {
    const plan: any = {
      nodes: [{ id: "out_1", type: "output", data: { label: "最终输出" } }],
      edges: [],
    };

    const { nodes } = normalizePlan(plan, "");
    const out = nodes.find(
      (n): n is AppNode & { type: "output"; data: OutputNodeData } => n.type === "output"
    );
    if (!out) throw new Error("Expected output node to exist");
    if (!out.data.inputMappings) throw new Error("Expected output.inputMappings to be normalized");

    expect(out.data.inputMappings.mode).toBe("select");
    expect(out.data.inputMappings.sources).toHaveLength(1);
  });
});
