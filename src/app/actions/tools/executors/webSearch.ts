import type { ToolExecutionResult } from "../types";

function buildWebSearchContent(results: unknown[]): string {
    const blocks: string[] = [];

    results.forEach((r, idx) => {
        if (!r || typeof r !== "object") return;
        const rec = r as Record<string, unknown>;

        const title = typeof rec.title === "string" ? rec.title.trim() : "";
        const url = typeof rec.url === "string" ? rec.url.trim() : "";
        const rawText =
            (typeof rec.content === "string" ? rec.content : "") ||
            (typeof rec.snippet === "string" ? rec.snippet : "") ||
            (typeof rec.summary === "string" ? rec.summary : "");

        const text = typeof rawText === "string" ? rawText.trim() : "";
        const clipped = text.length > 1200 ? `${text.slice(0, 1200)}...` : text;

        const header = title ? `${idx + 1}. ${title}` : `${idx + 1}.`;
        const lines = [header, url, clipped].filter(Boolean);
        if (lines.length > 0) blocks.push(lines.join("\n"));
    });

    return blocks.join("\n\n");
}

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
        const results = Array.isArray((data as any)?.results) ? (data as any).results : [];

        return {
            success: true,
            data: {
                query: inputs.query,
                content: buildWebSearchContent(results),
                results,
                count: results.length,
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
