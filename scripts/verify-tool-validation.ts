
import { validateToolInputs, TOOL_REGISTRY } from "../src/lib/tools/registry";
import { z } from "zod";

async function verify() {
    console.log("Starting verification...");

    // Test Case 1: Web Search with string number
    console.log("\nTest 1: Web Search with string '5'");
    const result1 = validateToolInputs("web_search", {
        query: "test",
        maxResults: "5"
    });

    if (result1.success && (result1.data as any).maxResults === 5) {
        console.log("✅ Passed: maxResults coerced to 5");
    } else {
        console.error("❌ Failed:", result1);
    }

    // Test Case 2: Web Search with actual number
    console.log("\nTest 2: Web Search with number 5");
    const result2 = validateToolInputs("web_search", {
        query: "test",
        maxResults: 5
    });

    if (result2.success && (result2.data as any).maxResults === 5) {
        console.log("✅ Passed: maxResults accepted as 5");
    } else {
        console.error("❌ Failed:", result2);
    }

    // Test Case 3: Datetime amount Coercion
    console.log("\nTest 3: Datetime amount string '10'");
    const result3 = validateToolInputs("datetime", {
        operation: "add",
        amount: "10",
        unit: "day"
    });
    if (result3.success && (result3.data as any).amount === 10) {
        console.log("✅ Passed: amount coerced to 10");
    } else {
        console.error("❌ Failed:", result3);
    }

}

verify().catch(console.error);
