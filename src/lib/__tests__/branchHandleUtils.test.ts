import { describe, it, expect } from "vitest";
import { ensureBranchHandles } from "@/lib/branchHandleUtils";
import type { AppEdge, AppNode } from "@/types/flow";

describe("ensureBranchHandles", () => {
  it("assigns true/false by target y when missing", () => {
    const nodes: AppNode[] = [
      { id: "b1", type: "branch", position: { x: 0, y: 0 }, data: { label: "B", condition: "true" } } as any,
      { id: "top", type: "tool", position: { x: 200, y: 0 }, data: { label: "Top" } } as any,
      { id: "bottom", type: "tool", position: { x: 200, y: 100 }, data: { label: "Bottom" } } as any,
    ];
    const edges: AppEdge[] = [
      { id: "e1", source: "b1", target: "top" } as any,
      { id: "e2", source: "b1", target: "bottom" } as any,
    ];

    const ensured = ensureBranchHandles(nodes, edges);
    const eTop = ensured.edges.find((e) => e.target === "top") as any;
    const eBottom = ensured.edges.find((e) => e.target === "bottom") as any;
    expect(eTop.sourceHandle).toBe("true");
    expect(eBottom.sourceHandle).toBe("false");
  });

  it("fills the missing handle when the other handle is already valid", () => {
    const nodes: AppNode[] = [
      { id: "b1", type: "branch", position: { x: 0, y: 0 }, data: { label: "B", condition: "true" } } as any,
      { id: "a", type: "tool", position: { x: 200, y: 0 }, data: { label: "A" } } as any,
      { id: "b", type: "tool", position: { x: 200, y: 100 }, data: { label: "B" } } as any,
    ];
    const edges: AppEdge[] = [
      { id: "e1", source: "b1", sourceHandle: "true", target: "a" } as any,
      { id: "e2", source: "b1", target: "b" } as any,
    ];

    const ensured = ensureBranchHandles(nodes, edges);
    const e2 = ensured.edges.find((e) => e.id === "e2") as any;
    expect(e2.sourceHandle).toBe("false");
  });
});

