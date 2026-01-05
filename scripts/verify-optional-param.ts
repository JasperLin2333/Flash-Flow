
import { validateToolInputs } from "../src/lib/tools/registry";

async function verify() {
    console.log("Starting verification...");

    // Simulate ToolDebugDialog logic:
    // It should filter OUT empty strings before calling validate.
    // So validation should see `maxResults` as undefined.

    const uiInput = {
        query: "test",
        maxResults: "" // UI state is string ""
    };

    // Logic from ToolDebugDialog:
    const debugInputs: Record<string, any> = {};
    Object.entries(uiInput).forEach(([key, value]) => {
        // Logic copied from component
        if (value === "" || value === undefined || value === null) return;
        debugInputs[key] = value;
    });

    console.log("Filtered inputs:", debugInputs);

    // Now validate
    const result = validateToolInputs("web_search", debugInputs);

    // Now that maxResults is required:
    // With cleaned inputs (maxResults removed), validation should FAIL.
    if (!result.success) {
        console.log("✅ Passed: maxResults is correctly required (validation failed as expected)");
        console.log("Error:", result.error);
    } else {
        console.error("❌ Failed: maxResults should be required but was accepted", result);
    }
}

verify().catch(console.error);
