import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
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

        // Generate unique display name to prevent collision
        const originalDisplayName = displayName || file.name;
        const uniqueDisplayName = `${originalDisplayName}_${nanoid(8)}`;

        // Upload file to File Search Store
        const operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: file,
            fileSearchStoreName,
            config: {
                displayName: uniqueDisplayName,
                chunkingConfig: {
                    whiteSpaceConfig: {
                        maxTokensPerChunk,
                        maxOverlapTokens
                    }
                }
            }
        });

        // Return operation name immediately for client-side polling
        // For small files, the operation might already be done
        const isDone = operation.done === true || !!(operation.response as any)?.documentName;

        return NextResponse.json({
            operationName: operation.name,
            uniqueDisplayName: uniqueDisplayName,
            status: isDone ? 'completed' : 'processing',
            done: isDone,
            result: isDone ? {
                name: (operation.response as any)?.documentName || (operation.response as any)?.name || uniqueDisplayName,
                displayName: uniqueDisplayName
            } : undefined
        });

    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error("[RAG Upload API] Error:", error);
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "上传失败" },
            { status: 500 }
        );
    }
}
