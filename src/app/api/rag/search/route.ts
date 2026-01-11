import { NextResponse } from "next/server";
export const runtime = 'nodejs'; // Node.js runtime required for file system operations
import { GoogleGenAI } from '@google/genai';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { incrementQuotaOnServer } from "@/lib/quotaEdge";
import { getMimeType } from "@/utils/mimeUtils";
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ============ Constants ============
const RAG_MODEL = 'gemini-2.5-flash';

// ============ Types ============
interface SearchRequest {
    mode: 'fileSearch' | 'multimodal';
    query: string;
    // For fileSearch mode
    fileSearchStoreName?: string;
    // For multimodal mode
    files?: Array<{ name: string; url: string; type?: string }>;
}

// ============ Helper: Download File ============
async function downloadFile(url: string, extension: string): Promise<string> {
    const tempDir = os.tmpdir();
    const fileName = `${uuidv4()}${extension}`; // Unique filename
    const filePath = path.join(tempDir, fileName);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));

    return filePath;
}

// ============ API Handler ============
export async function POST(req: Request) {
    let uploadedFileNames: string[] = [];
    let fileManager: GoogleAIFileManager | null = null;
    let localFilePaths: string[] = [];

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
            // ============ Unified RAG Pipeline (Hybrid: Local Parse for DOCX/Text, Cloud for Other) ============
            const { files } = body;

            if (!files || files.length === 0) {
                return NextResponse.json({ error: "未提供文件" }, { status: 400 });
            }

            fileManager = new GoogleAIFileManager(apiKey);
            const parts: any[] = [];

            // 1. Process Files (Hybrid Pipeline)
            for (const file of files) {
                if (!file.url) continue;

                try {
                    // Determine extension and mime
                    const ext = path.extname(file.name) || '';
                    const mimeType = file.type || getMimeType(file.name);

                    // A. Download to Temp (Universal Step)
                    const localPath = await downloadFile(file.url, ext);
                    localFilePaths.push(localPath);

                    // B. Branching Logic based on Type

                    // Branch 1: DOCX -> Mammoth (Local Parse)
                    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                        try {
                            const mammoth = await import('mammoth');
                            const buffer = await fs.promises.readFile(localPath);
                            const result = await mammoth.convertToHtml({ buffer });

                            parts.push({
                                text: `[File Context: ${file.name}]\n${result.value}`
                            });
                            // No upload to Gemini needed for DOCX
                        } catch (e) {
                            console.error(`[RAG] Failed to parse DOCX ${file.name}:`, e);
                        }
                        continue; // Skip uploading
                    }

                    // Branch 2: Plain Text -> fs.readFile (Local Parse)
                    // Includes .txt, .md, code files etc.
                    if (mimeType.startsWith('text/') || ext.match(/\.(json|yaml|yml|xml|html|css|js|ts|py|c|cpp|h|java|go|rs|sh|log)$/i)) {
                        try {
                            const textContent = await fs.promises.readFile(localPath, 'utf-8');
                            parts.push({
                                text: `[File Context: ${file.name}]\n${textContent}`
                            });
                        } catch (e) {
                            console.error(`[RAG] Failed to read text file ${file.name}:`, e);
                        }
                        continue; // Skip uploading
                    }

                    // Branch 3: PDF / Image / Video / Audio -> Gemini File API (Native Support)
                    // These formats are supported by Gemini's Long Context Window via File API

                    const uploadResult = await fileManager.uploadFile(localPath, {
                        mimeType,
                        displayName: file.name
                    });

                    const fileUri = uploadResult.file.uri;
                    const fileName = uploadResult.file.name; // internal name
                    uploadedFileNames.push(fileName);

                    // Wait for Active State
                    let fileState = uploadResult.file.state;
                    let attempt = 0;
                    while (fileState === 'PROCESSING' && attempt < 30) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const getFileResponse = await fileManager.getFile(fileName);
                        fileState = getFileResponse.state;
                        // if (fileState === 'FAILED') { ... } // simplified error check
                        if (fileState === 'FAILED') break;
                        attempt++;
                    }

                    if (fileState !== 'ACTIVE') {
                        console.warn(`[RAG] File ${fileName} check failed/timeout. State: ${fileState}`);
                        continue;
                    }

                    // Add to Parts
                    parts.push({
                        fileData: {
                            mimeType: uploadResult.file.mimeType,
                            fileUri: fileUri
                        }
                    });

                } catch (e) {
                    console.error(`[RAG] Error processing file ${file.name}:`, e);
                }
            }

            if (parts.length === 0) {
                return NextResponse.json({ error: "无法加载任何有效文件" }, { status: 400 });
            }

            parts.push({ text: query });

            // 2. Generate Content
            const response = await ai.models.generateContent({
                model: RAG_MODEL,
                contents: [{ role: 'user', parts }]
            });

            const text = response.text || '';
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
    } finally {
        // ============ Cleanup ============
        // 1. Delete Remote Files
        if (fileManager && uploadedFileNames.length > 0) {
            Promise.allSettled(uploadedFileNames.map(name => fileManager!.deleteFile(name)))
                .then(results => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[RAG Cleanup] Deleted ${results.length} remote files.`);
                    }
                });
        }
        // 2. Delete Local Temp Files
        if (localFilePaths.length > 0) {
            Promise.allSettled(localFilePaths.map(p => fs.promises.unlink(p)))
                .then(() => { });
        }
    }
}
