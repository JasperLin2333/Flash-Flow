import type { ToolExecutionResult } from "../types";

/**
 * Execute Web Search using Tavily API (direct HTTP call)
 */
export async function executeWebSearch(inputs: { query: string; maxResults?: number }): Promise<ToolExecutionResult> {
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
