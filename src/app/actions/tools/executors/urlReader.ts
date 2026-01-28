import type { ToolExecutionResult } from "../types";
import { cleanHtmlContent } from "../types";
import dns from 'dns/promises';

/**
 * Check if an IP is private/internal
 */
function isPrivateIP(ip: string): boolean {
    // IPv4 check
    if (ip.includes('.')) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return false; // Invalid IPv4?

        // 127.0.0.0/8 (Loopback)
        if (parts[0] === 127) return true;
        // 10.0.0.0/8 (Private)
        if (parts[0] === 10) return true;
        // 172.16.0.0/12 (Private)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        // 192.168.0.0/16 (Private)
        if (parts[0] === 192 && parts[1] === 168) return true;
        // 169.254.0.0/16 (Link-local)
        if (parts[0] === 169 && parts[1] === 254) return true;
        // 0.0.0.0/8 (Current network)
        if (parts[0] === 0) return true;
        
        return false;
    } 
    
    // IPv6 check
    if (ip.includes(':')) {
        // ::1 (Loopback)
        if (ip === '::1') return true;
        // fe80::/10 (Link-local)
        if (ip.toLowerCase().startsWith('fe80:')) return true;
        // fc00::/7 (Unique Local)
        if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
        
        return false;
    }

    return false;
}

/**
 * Validate URL and DNS resolution to prevent SSRF
 */
async function validateUrl(urlStr: string): Promise<void> {
    let urlObj: URL;
    try {
        urlObj = new URL(urlStr);
    } catch {
        throw new Error('无效的 URL 格式');
    }

    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error('仅支持 HTTP/HTTPS 协议');
    }

    // Resolve hostname
    try {
        const { address } = await dns.lookup(urlObj.hostname);
        if (isPrivateIP(address)) {
            throw new Error(`禁止访问私有网络地址 (${urlObj.hostname} -> ${address})`);
        }
    } catch (e) {
        if (e instanceof Error && e.message.includes('禁止访问')) throw e;
        // If DNS fails, we can't fetch anyway
        throw new Error(`DNS 解析失败: ${urlObj.hostname}`);
    }
}

/**
 * Execute URL Reader to extract main content from a web page
 */
export async function executeUrlReader(inputs: { url: string; maxLength?: number }): Promise<ToolExecutionResult> {
    try {
        const maxLength = inputs.maxLength || 5000;
        let currentUrl = inputs.url;
        let redirectCount = 0;
        const maxRedirects = 5;

        // Manual redirect handling to validate each hop
        let response: Response | null = null;

        while (redirectCount < maxRedirects) {
            await validateUrl(currentUrl);

            response = await fetch(currentUrl, {
                redirect: 'manual',
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; FlashFlowBot/1.0)",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                },
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) {
                    throw new Error(`重定向响应缺少 Location 头: ${response.status}`);
                }
                
                // Handle relative URLs
                currentUrl = new URL(location, currentUrl).toString();
                redirectCount++;
                continue;
            }

            break;
        }

        if (!response || !response.ok) {
             throw new Error(`无法访问页面: ${response?.status} ${response?.statusText}`);
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
