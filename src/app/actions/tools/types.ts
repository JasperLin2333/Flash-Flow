/**
 * Tool execution result type
 */
export interface ToolExecutionResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * Tool execution input type
 */
export interface ToolExecutionInput {
    toolType: string;
    inputs: Record<string, unknown>;
}

// ============ Helper Functions ============

/**
 * Format a date object to a specific format string
 */
export function formatDate(date: Date, fmt: string): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return fmt
        .replace("YYYY", year.toString())
        .replace("MM", month)
        .replace("DD", day)
        .replace("HH", hours)
        .replace("mm", minutes)
        .replace("ss", seconds);
}

/**
 * Parse a date string or return current date if not provided
 */
export function parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
        throw new Error(`无法解析日期: ${dateStr}`);
    }
    return parsed;
}

/**
 * Clean HTML content by removing scripts, styles, and tags
 */
export function cleanHtmlContent(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}
