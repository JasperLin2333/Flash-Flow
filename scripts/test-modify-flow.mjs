import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000'; // Adjust port if needed

// Test cases for Intent Classification
const testCases = [
    // Basic Modifications
    { prompt: "Add a memory to the LLM node", expectedIntent: "modify_attribute" },
    { prompt: "Change the temperature to 0.7", expectedIntent: "modify_attribute" },

    // Add/Delete
    { prompt: "Add a web search node after input", expectedIntent: "add_node" },
    { prompt: "Delete the image generation node", expectedIntent: "delete_node" },

    // Restructure (Global changes)
    { prompt: "Refactor this to be parallel", expectedIntent: "restructure" },
    { prompt: "Change the whole flow to use a map-reduce pattern", expectedIntent: "restructure" },

    // Chinese Inputs
    { prompt: "给 LLM 开启只有 5 轮的记忆", expectedIntent: "modify_attribute" }, // Enable memory with 5 turns
    { prompt: "帮我加一个联网搜索功能", expectedIntent: "add_node" }, // Add web search
    { prompt: "把这个分支删掉", expectedIntent: "delete_node" }, // Delete branch

    // Ambiguous / Implicit
    { prompt: "The output is too random, make it more stable", expectedIntent: "modify_attribute" }, // Implies lowering temperature
    { prompt: "I need to analyze this file", expectedIntent: "modify_attribute" }, // Implies RAG or input config? Or add RAG?

    // Multi-step (Classifier usually picks the dominant one or falls back to restructure/patch)
    { prompt: "Remove the search node and add a RAG node instead", expectedIntent: "restructure" }, // Delete + Add -> often restructure or complex patch

    // Specific Node Types
    { prompt: "Use Stable Diffusion 3 for the image", expectedIntent: "modify_attribute" },
    { prompt: "Make the input accept PDF files", expectedIntent: "modify_attribute" },
];

async function runTest() {
    console.log("🚀 Starting Modify Flow Tests...\n");

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        console.log(`Testing: "${test.prompt}"`);
        try {
            const response = await fetch(`${BASE_URL}/api/classify-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-flash-test-user': 'true', // Bypass auth
                },
                body: JSON.stringify({ prompt: test.prompt }),
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const result = await response.json();
            const isMatch = result.intent === test.expectedIntent;

            if (isMatch) {
                console.log(`✅ Passed. Intent: ${result.intent} (Confidence: ${result.confidence})`);
                passed++;
            } else {
                console.log(`❌ Failed. Expected ${test.expectedIntent}, got ${result.intent}`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            failed++;
        }
        console.log('---');
    }

    console.log(`\nTest Summary: ${passed} Passed, ${failed} Failed`);
}

runTest();
