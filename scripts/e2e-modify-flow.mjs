import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// ============ Mock Data ============
const mockNodes = [
    {
        id: "node-input",
        type: "input",
        position: { x: 0, y: 0 },
        data: { label: "Input", enableTextInput: true }
    },
    {
        id: "node-llm",
        type: "llm",
        position: { x: 200, y: 0 },
        data: {
            label: "LLM Processor",
            model: "gpt-4o",
            temperature: 0.5,
            systemPrompt: "You are a helpful assistant."
        }
    },
    {
        id: "node-output",
        type: "output",
        position: { x: 400, y: 0 },
        data: { label: "Output" }
    }
];

const mockEdges = [
    { id: "edge-1", source: "node-input", target: "node-llm" },
    { id: "edge-2", source: "node-llm", target: "node-output" }
];

// ============ Test Helper ============
async function callModifyFlow(prompt, mode = "patch") {
    console.log(`\n🧪 Testing: "${prompt}" [Mode: ${mode}]`);

    try {
        const response = await fetch(`${BASE_URL}/api/modify-flow`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-flash-test-user": "true"
            },
            body: JSON.stringify({
                prompt,
                currentNodes: mockNodes,
                currentEdges: mockEdges,
                mode
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("❌ Request failed:", error.message);
        return null;
    }
}

// ============ Test Scenarios ============
async function runE2E() {
    console.log("🚀 Starting E2E Business Logic Tests...");

    // Scenario 1: Parameter Tuning (Patch)
    const res1 = await callModifyFlow("Set the LLM temperature to 0.1 for more deterministic output", "patch");
    if (res1?.patches?.some(p => p.nodeId === "node-llm" && p.data.temperature === 0.1)) {
        console.log("✅ Scenario 1 Passed: Temperature updated correctly.");
    } else {
        console.log("❌ Scenario 1 Failed:", JSON.stringify(res1, null, 2));
    }

    // Scenario 2: Context Reference (Patch)
    const res2 = await callModifyFlow("Update system prompt to say 'Hello' to the user input {{node-input.user_input}}", "patch");
    // Note: The AI might infer variable syntax. We check if it attempted to change systemPrompt.
    const patch2 = res2?.patches?.find(p => p.nodeId === "node-llm");
    if (patch2 && patch2.data.systemPrompt && patch2.data.systemPrompt.includes("Hello")) {
        console.log("✅ Scenario 2 Passed: System prompt updated.");
        console.log("   -> Value:", patch2.data.systemPrompt);
    } else {
        console.log("❌ Scenario 2 Failed:", JSON.stringify(res2, null, 2));
    }

    // Scenario 3: Add RAG Node (Full Mode implied for structural change, or patch add action)
    // Let's force "patch" mode first to see if it returns an 'add' action (if supported) or we use full mode.
    // The current route.ts for 'patch' mode prompt supports "Add node" in JSON output.
    const res3 = await callModifyFlow("Add a RAG node to search for 'contract laws' before the LLM", "patch");

    // Check for 'add' action structure from the prompt: { action: "add", nodeType: "rag", ... }
    // OR checks patches if it tried to patch. 
    // Wait, the prompt in route.ts defines: { "patches": [...] } OR { "action": "add", ... }?
    // Let's check route.ts prompt... It has sections # Add Node and # Delete Node with example formats.
    // But the valid output format for 'patch' is usually just the JSON object. 
    // If the model returns `{"action": "add" ...}`, that's valid JSON.

    if (res3?.action === "add" && res3?.nodeType === "rag") {
        console.log("✅ Scenario 3 Passed: RAG node addition detected.");
        console.log("   -> Config:", res3.nodeData);
    } else if (res3?.patches) {
        // Handle case where add is returned as a patch in patches array
        const addPatch = res3.patches.find(p => p.action === "add" && p.nodeType === "rag");
        if (addPatch) {
            console.log("✅ Scenario 3 Passed: RAG node addition detected (Patch format).");
            console.log("   -> Config:", addPatch.nodeData);
        } else {
            console.log("⚠️ Scenario 3 Result:", JSON.stringify(res3, null, 2));
        }
    } else {
        console.log("⚠️ Scenario 3 Result:", JSON.stringify(res3, null, 2));
    }

    // Scenario 4: High Quality LLM Prompt Generation (Full Mode / Add)
    // We force 'full' mode (or implicitly trigger it by complex request) to generate a full system prompt.
    // Actually, 'patch' mode prompt doesn't usually generate long system prompts unless asked.
    // Let's try adding a new LLM node for a specific persona.
    const res4 = await callModifyFlow("Add a new LLM node that acts as a Python Code Reviewer after the RAG node", "patch");

    let newLLMNode;
    if (res4?.patches) {
        // Look for add action in patches
        const p = res4.patches.find(p => p.action === "add" && p.nodeType === "llm");
        newLLMNode = p?.nodeData;
    } else if (res4?.action === "add" && res4?.nodeType === "llm") {
        newLLMNode = res4.nodeData;
    }

    if (newLLMNode) {
        const prompt = newLLMNode.config?.systemPrompt || newLLMNode.data?.systemPrompt || "";
        console.log("\n🧪 Scenario 4 Prompt Check:");
        // Only print first 200 chars to keep logs clean
        console.log(prompt.slice(0, 200) + "...");

        const hasRole = prompt.includes("# Role") || prompt.includes("# 角色");
        const hasTask = prompt.includes("# Task") || prompt.includes("# 核心任务") || prompt.includes("# 任务");

        if (hasRole || hasTask) {
            console.log("✅ Scenario 4 Passed: Prompt follows High-Quality structure.");
        } else {
            console.log("⚠️ Scenario 4 Warning: Prompt might lack structure.");
        }
    } else {
        console.log("⚠️ Scenario 4 Result: No LLM node added or failed.", JSON.stringify(res4, null, 2));
    }
}

runE2E();
