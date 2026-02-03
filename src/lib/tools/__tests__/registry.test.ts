import { describe, expect, it } from "vitest";
import { validateToolInputs } from "../registry";

describe("tool registry validation defaults", () => {
  it("defaults web_search.maxResults when missing", () => {
    const result = validateToolInputs("web_search" as any, { query: "hello" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as any).maxResults).toBe(5);
  });
});

