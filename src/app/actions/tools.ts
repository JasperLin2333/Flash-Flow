"use server";

import { validateToolInputs, type ToolType } from "@/lib/tools/registry";
import { evaluate } from "mathjs";

// ============ Types ============

interface ToolExecutionResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

interface ToolExecutionInput {
    toolType: ToolType;
    inputs: Record<string, unknown>;
}

// ============ Tool Execution Handlers ============

/**
 * Execute Web Search using Tavily API (direct HTTP call)
 */
async function executeWebSearch(inputs: { query: string; maxResults?: number }): Promise<ToolExecutionResult> {
    try {
        const apiKey = process.env.TAVILY_API_KEY;

        if (!apiKey) {
            return {
                success: false,
                error: "Tavily API key not configured. Please add TAVILY_API_KEY to your environment variables.",
            };
        }

        // Direct Tavily API call
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: inputs.query,
                max_results: inputs.maxResults || 5,
                search_depth: "basic",
                include_answer: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return {
            success: true,
            data: {
                query: inputs.query,
                results: data.results || [],
                count: (data.results || []).length,
            },
        };
    } catch (error) {
        console.error("Web search error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to execute web search",
        };
    }
}

/**
 * Execute Calculator using mathjs
 */
async function executeCalculator(inputs: { expression: string }): Promise<ToolExecutionResult> {
    try {
        if (!inputs.expression || inputs.expression.trim() === "") {
            return {
                success: false,
                error: "Expression is required",
            };
        }

        // Use mathjs for safe evaluation
        const result = evaluate(inputs.expression);

        return {
            success: true,
            data: {
                expression: inputs.expression,
                result,
            },
        };
    } catch (error) {
        console.error("Calculator error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to evaluate expression",
        };
    }
}

// ============ Main Execution Function ============

/**
 * Execute a tool with the given inputs
 * 
 * This is the main server action that:
 * 1. Validates inputs against the tool's Zod schema
 * 2. Routes to the appropriate tool execution handler
 * 3. Returns structured results or errors
 * 
 * @param input - Tool type and inputs
 * @returns Execution result with success status and data/error
 */
export async function executeToolAction(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    const { toolType, inputs } = input;

    // Validate inputs against the tool's schema
    const validation = validateToolInputs(toolType, inputs);

    if (!validation.success) {
        return {
            success: false,
            error: `Invalid inputs: ${validation.error}`,
        };
    }

    // Route to the appropriate tool handler with proper type narrowing
    try {
        switch (toolType) {
            case "web_search": {
                const webSearchInputs = validation.data as { query: string; maxResults?: number };
                return await executeWebSearch(webSearchInputs);
            }

            case "calculator": {
                const calcInputs = validation.data as { expression: string };
                return await executeCalculator(calcInputs);
            }

            default:
                return {
                    success: false,
                    error: `Unknown tool type: ${toolType}`,
                };
        }
    } catch (error) {
        console.error(`Tool execution error (${toolType}):`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Tool execution failed",
        };
    }
}


