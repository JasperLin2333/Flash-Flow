import { NextResponse } from "next/server";
export const runtime = 'edge';
import { GoogleGenAI } from '@google/genai';
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { incrementQuotaOnServer } from "@/lib/quotaEdge";
import { getMimeType } from "@/utils/mimeUtils";

// ============ Constants ============
const RAG_MODEL = 'gemini-2.5-flash';

// ============ Types ============
interface SearchRequest {
    mode: 'fileSearch' | 'multimodal';
    query: string;
    // For fileSearch mode
    fileSearchStoreName?: string;
    // Note: topK is managed internally by Gemini API, not configurable via this API
    // For multimodal mode
    files?: Array<{ name: string; url: string; type?: string }>;
}

// ============ API Handler ============
export async function POST(req: Request) {
    try {
        // Authentication check
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return unauthorizedResponse();
        }

        // Validate API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API Key 未配置" },
                { status: 500 }
            );
        }

        const body: SearchRequest = await req.json();
        const { mode, query } = body;

        if (!query || !query.trim()) {
            return NextResponse.json(
                { error: "查询内容不能为空" },
                { status: 400 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        if (mode === 'fileSearch') {
            // File Search Store mode
            const { fileSearchStoreName } = body;
            // Note: topK is managed internally by Gemini API, not configurable

            if (!fileSearchStoreName) {
                return NextResponse.json(
                    { error: "未指定 FileSearchStore" },
                    { status: 400 }
                );
            }

            const response = await ai.models.generateContent({
                model: RAG_MODEL,
                contents: query,
                config: {
                    tools: [
                        {
                            fileSearch: {
                                fileSearchStoreNames: [fileSearchStoreName]
                            }
                        }
                    ]
                }
            });

            const text = response.text || '';
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata as {
                groundingChunks?: Array<{ web?: { uri?: string; title?: string }; retrievedContext?: { uri?: string; title?: string } }>;
                groundingSupports?: Array<{ segment?: { text?: string }; groundingChunkIndices?: number[] }>;
            } | undefined;

            // Extract citations from groundingChunks
            const chunks = groundingMetadata?.groundingChunks || [];
            const supports = groundingMetadata?.groundingSupports || [];

            // Build citations array
            const citations: Array<{ source: string; chunk: string }> = [];

            // Extract text segments from groundingSupports
            for (const support of supports) {
                const segmentText = support.segment?.text || '';
                const chunkIndices = support.groundingChunkIndices || [];

                for (const idx of chunkIndices) {
                    const chunk = chunks[idx];
                    if (chunk) {
                        // Handle both web and retrievedContext sources
                        const source = chunk.retrievedContext?.title || chunk.web?.title || 'Unknown';
                        citations.push({
                            source,
                            chunk: segmentText
                        });
                    }
                }
            }

            // If no supports, just use chunks directly
            if (citations.length === 0 && chunks.length > 0) {
                for (const chunk of chunks) {
                    const source = chunk.retrievedContext?.title || chunk.web?.title || 'Unknown';
                    citations.push({
                        source,
                        chunk: ''
                    });
                }
            }

            // Extract document content from citations or use response text
            const documents = citations.map(c => c.chunk).filter(Boolean);

            // Deduct quota on success
            await incrementQuotaOnServer(req, user.id, "llm_executions");

            return NextResponse.json({
                documents: documents.length > 0 ? documents : [text],
                citations: citations.length > 0 ? citations : undefined
            });

        } else if (mode === 'multimodal') {
            // Multimodal mode (dynamic files)
            const { files } = body;

            if (!files || files.length === 0) {
                return NextResponse.json(
                    { error: "未提供文件" },
                    { status: 400 }
                );
            }

            const parts: any[] = [];

            // Fetch and encode files
            for (const file of files) {
                if (!file.url) continue;

                try {
                    const response = await fetch(file.url);
                    if (!response.ok) {
                        if (process.env.NODE_ENV === 'development') {
                            console.warn(`[RAG Search] Failed to fetch file: ${file.name}`);
                        }
                        continue;
                    }

                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuffer).toString('base64');
                    const mimeType = file.type || blob.type || getMimeType(file.name);

                    parts.push({
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    });
                } catch (fetchError) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(`[RAG Search] Error fetching file ${file.name}:`, fetchError);
                    }
                }
            }

            if (parts.length === 0) {
                return NextResponse.json(
                    { error: "无法加载任何有效文件" },
                    { status: 400 }
                );
            }

            parts.push({ text: query });

            const response = await ai.models.generateContent({
                model: RAG_MODEL,
                contents: [{ role: 'user', parts }]
            });

            const text = response.text || '';

            // Deduct quota on success
            await incrementQuotaOnServer(req, user.id, "llm_executions");

            return NextResponse.json({
                documents: [text],
                citations: files.map(f => ({ source: f.name, chunk: '' }))
            });

        } else {
            return NextResponse.json(
                { error: "无效的搜索模式" },
                { status: 400 }
            );
        }

    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error("[RAG Search API] Error:", error);
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "搜索失败" },
            { status: 500 }
        );
    }
}
