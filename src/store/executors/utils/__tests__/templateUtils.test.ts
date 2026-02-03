import { describe, expect, it } from "vitest";
import { deepReplaceVariablesInUnknown } from "../templateUtils";

describe("deepReplaceVariablesInUnknown", () => {
  it("replaces nested string templates in objects and arrays", () => {
    const input = {
      code: "print('{{x}}')",
      inputFiles: [
        { name: "data.csv", url: "{{Input.files[0].url}}" },
        { name: "notes.txt", url: "https://example.com/notes.txt" },
      ],
    };

    const variables = {
      x: "42",
      "Input.files[0].url": "https://example.com/data.csv",
    };

    const out = deepReplaceVariablesInUnknown(input, variables) as any;
    expect(out.code).toBe("print('42')");
    expect(out.inputFiles[0].url).toBe("https://example.com/data.csv");
    expect(out.inputFiles[1].url).toBe("https://example.com/notes.txt");
  });
});

