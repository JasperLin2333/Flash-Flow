import { describe, expect, it } from "vitest";
import { normalizeLoadedFlowData } from "@/services/flowDataNormalizer";
import type { FlowData } from "@/types/flow";

describe("normalizeLoadedFlowData", () => {
  it("normalizes Input node defaults and removes runtime fields", () => {
    const data: FlowData = {
      nodes: [
        {
          id: "in1",
          type: "input",
          position: { x: 0, y: 0 },
          data: {
            label: "输入",
            status: "completed",
            executionTime: 10,
            output: { x: 1 },
            text: "persisted user input",
            files: [{ name: "a", size: 1, type: "text/plain", url: "u" }],
            formData: { a: "x" },
            enableStructuredForm: true,
            formFields: [],
            enableFileInput: true,
          } as any,
        } as any,
      ],
      edges: [],
    };

    const normalized = normalizeLoadedFlowData(data);
    const node = normalized.nodes[0] as any;
    const d = node.data as any;

    expect(d.status).toBe("idle");
    expect(d.enableTextInput).toBe(true);
    expect(d.enableFileInput).toBe(true);
    expect(d.enableStructuredForm).toBe(true);
    expect(d.fileConfig).toBeTruthy();
    expect(Array.isArray(d.fileConfig.allowedTypes)).toBe(true);
    expect(typeof d.fileConfig.maxSizeMB).toBe("number");
    expect(typeof d.fileConfig.maxCount).toBe("number");
    expect(Array.isArray(d.formFields)).toBe(true);
    expect(d.formFields.length).toBe(1);
    expect("executionTime" in d).toBe(false);
    expect("output" in d).toBe(false);
    expect("text" in d).toBe(false);
    expect("files" in d).toBe(false);
    expect("formData" in d).toBe(false);
  });

  it("sanitizes and de-duplicates form field names", () => {
    const data: FlowData = {
      nodes: [
        {
          id: "in2",
          type: "input",
          position: { x: 0, y: 0 },
          data: {
            label: "输入",
            enableStructuredForm: true,
            formFields: [
              { type: "text", name: "中文", label: "中文", required: false },
              { type: "text", name: "a", label: "A", required: false },
              { type: "text", name: "a", label: "A2", required: false },
              { type: "text", name: "1bad", label: "B", required: false },
            ],
          } as any,
        } as any,
      ],
      edges: [],
    };

    const normalized = normalizeLoadedFlowData(data);
    const fields = (normalized.nodes[0] as any).data.formFields as Array<{ name: string }>;
    const names = fields.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((n) => expect(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n)).toBe(true));
  });
});

