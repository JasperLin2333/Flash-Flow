import { describe, expect, it } from "vitest";
import { collectVariables } from "../variableUtils";

describe("collectVariables ambiguity handling", () => {
  it("does not inject ambiguous unprefixed variables from global context", () => {
    const nodes: any[] = [
      { id: "t1", type: "tool", position: { x: 0, y: 0 }, data: { label: "ToolA" } },
      { id: "t2", type: "tool", position: { x: 0, y: 0 }, data: { label: "ToolB" } },
    ];

    const globalFlowContext: any = {
      t1: { results: [{ a: 1 }] },
      t2: { results: [{ b: 2 }] },
    };

    const vars = collectVariables({} as any, globalFlowContext, nodes as any);
    expect("results" in vars).toBe(false);
    expect(vars["__ambiguous.results"]).toBe("true");
  });

  it("allows direct-upstream to inject unprefixed variables even if global is ambiguous", () => {
    const nodes: any[] = [
      { id: "t1", type: "tool", position: { x: 0, y: 0 }, data: { label: "ToolA" } },
      { id: "t2", type: "tool", position: { x: 0, y: 0 }, data: { label: "ToolB" } },
    ];

    const globalFlowContext: any = {
      t1: { results: [{ a: 1 }] },
      t2: { results: [{ b: 2 }] },
    };

    const directContext: any = {
      t1: { results: [{ a: 1 }] },
    };

    const vars = collectVariables(directContext, globalFlowContext, nodes as any);
    expect(vars.results).toBe(JSON.stringify([{ a: 1 }]));
    expect("__ambiguous.results" in vars).toBe(false);
    expect(vars["__ambiguous.results"]).toBeUndefined();
  });
});
