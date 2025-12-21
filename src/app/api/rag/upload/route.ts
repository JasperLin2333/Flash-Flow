import { NextResponse } from "next/server";
// Note: Using nodejs runtime for file upload handling
export const runtime = 'nodejs';
import { GoogleGenAI } from '@google/genai';
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";

// ============ Constants ============
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_TOKENS_PER_CHUNK = 200;
const DEFAULT_MAX_OVERLAP_TOKENS = 20;

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

        // Parse multipart form data
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const fileSearchStoreName = formData.get('fileSearchStoreName') as string | null;
        const displayName = formData.get('displayName') as string | null;
        const maxTokensPerChunk = parseInt(formData.get('maxTokensPerChunk') as string) || DEFAULT_MAX_TOKENS_PER_CHUNK;
        const maxOverlapTokens = parseInt(formData.get('maxOverlapTokens') as string) || DEFAULT_MAX_OVERLAP_TOKENS;

        if (!file) {
            return NextResponse.json(
                { error: "未提供文件" },
                { status: 400 }
            );
        }

        if (!fileSearchStoreName) {
            return NextResponse.json(
                { error: "未指定 FileSearchStore" },
                { status: 400 }
            );
        }

        // File size check
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `文件大小超过 ${MAX_FILE_SIZE / 1024 / 1024}MB 限制` },
                { status: 400 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        // Upload file to File Search Store
        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: file,
            fileSearchStoreName,
            config: {
                displayName: displayName || file.name,
                chunkingConfig: {
                    whiteSpaceConfig: {
                        maxTokensPerChunk,
                        maxOverlapTokens
                    }
                }
            }
        });

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60; // Max 5 minutes

        while (!operation.done && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.get({ operation });
            attempts++;
        }

        if (!operation.done) {
            return NextResponse.json(
                { error: "文件处理超时（5分钟）" },
                { status: 408 }
            );
        }

        if (operation.error) {
            return NextResponse.json(
                { error: `文件处理失败: ${operation.error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            name: file.name,
            displayName: displayName || file.name,
            sizeBytes: file.size
        });

    } catch (error) {
        console.error("[RAG Upload API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "上传失败" },
            { status: 500 }
        );
    }
}
