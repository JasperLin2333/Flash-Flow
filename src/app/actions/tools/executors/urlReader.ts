import type { ToolExecutionResult } from "../types";
import { cleanHtmlContent } from "../types";

/**
 * Execute URL Reader to extract main content from a web page
 */
export async function executeUrlReader(inputs: { url: string; maxLength?: number }): Promise<ToolExecutionResult> {
    try {
        const maxLength = inputs.maxLength || 5000;

        // Fetch the page
        const response = await fetch(inputs.url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; FlashFlowBot/1.0)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        });

        if (!response.ok) {
            throw new Error(`无法访问页面: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            return {
                success: false,
                error: `不支持的内容类型: ${contentType}。仅支持 HTML 和纯文本页面。`,
            };
        }

        const html = await response.text();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "无标题";

        // Clean content using helper
        let content = cleanHtmlContent(html);

        // Truncate to maxLength
        if (content.length > maxLength) {
            content = content.substring(0, maxLength) + "...";
        }

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const description = descMatch ? descMatch[1].trim() : "";

        return {
            success: true,
            data: {
                url: inputs.url,
                title,
                description,
                content,
                contentLength: content.length,
                truncated: content.length >= maxLength,
            },
        };
    } catch (error) {
        console.error("URL Reader error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "网页读取失败",
        };
    }
}
