import { describe, it, expect } from "vitest";
import { HARD_ERROR_SPECS_V1_2 } from "@/lib/agent/validationSpecV1";
import { validateGeneratedWorkflowV1_2 } from "@/lib/agent/generatedWorkflowValidatorV1";

describe("validateGeneratedWorkflowV1_2 - Hard Error minimal repros", () => {
  for (const spec of HARD_ERROR_SPECS_V1_2) {
    it(`should trigger ${spec.code}`, () => {
      const res = validateGeneratedWorkflowV1_2(spec.minimalRepro.nodes, spec.minimalRepro.edges);
      const codes = res.hardErrors.map((e) => e.code);
      expect(codes).toContain(spec.code);
    });
  }
});

describe("validateGeneratedWorkflowV1_2 - RAG mode-aware validation", () => {
  it("accepts variable mode with query + files mapping", () => {
    const res = validateGeneratedWorkflowV1_2(
      [
        {
          id: "r",
          type: "rag",
          data: {
            label: "RAG",
            fileMode: "variable",
            inputMappings: { query: "{{Input.user_input}}", files: "{{Input.files}}" },
          },
        },
      ],
      []
    );
    expect(res.hardErrors.map((e) => e.code)).not.toContain("FFV-RAG-001");
  });

  it("accepts static mode with query + fileSearchStoreName (no files mapping required)", () => {
    const res = validateGeneratedWorkflowV1_2(
      [
        {
          id: "r",
          type: "rag",
          data: {
            label: "RAG",
            fileMode: "static",
            fileSearchStoreName: "fileSearchStores/abc123",
            inputMappings: { query: "{{Input.user_input}}" },
          },
        },
      ],
      []
    );
    expect(res.hardErrors.map((e) => e.code)).not.toContain("FFV-RAG-001");
  });

  it("accepts legacy RAG when fileMode missing but storeName present", () => {
    const res = validateGeneratedWorkflowV1_2(
      [
        {
          id: "r",
          type: "rag",
          data: {
            label: "RAG",
            fileSearchStoreName: "fileSearchStores/abc123",
            inputMappings: { query: "{{Input.user_input}}" },
          },
        },
      ],
      []
    );
    expect(res.hardErrors.map((e) => e.code)).not.toContain("FFV-RAG-001");
  });

  it("accepts legacy RAG when fileMode missing but dynamic file mappings present", () => {
    const res = validateGeneratedWorkflowV1_2(
      [
        {
          id: "r",
          type: "rag",
          data: {
            label: "RAG",
            inputMappings: { query: "{{Input.user_input}}", files2: "{{Input.files}}" },
          },
        },
      ],
      []
    );
    expect(res.hardErrors.map((e) => e.code)).not.toContain("FFV-RAG-001");
  });
});
