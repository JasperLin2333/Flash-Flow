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

        // 尝试获取 Gemini 分配的资源名称 (files/xxx)
        //由于 uploadToFileSearchStore 不直接返回 name，我们需要通过 list files 来查找
        let geminiResourceName = "";
        try {
            const listResponse = await ai.files.list({
                config: { pageSize: 100 } // 获取最近的 100 个文件应该足够找到刚刚上传的
            });

            // 在列表中查找匹配 displayName 的文件
            // 注意：可能会有同名文件，我们假设最近的一个是刚刚上传的（API通常按时间倒序或顺序返回吗？Gemini API 文档未明确，但通常是最近的）
            // 如果能获取到 list 的顺序，最好找到 creationTime 最近的

            const matchedFiles: any[] = [];
            const targetDisplayName = displayName || file.name;

            // Iterate through the pager (Pager<File_2> is async iterable)
            let count = 0;
            // @ts-ignore Pager usually supports async iteration
            for await (const f of listResponse) {
                if (f.displayName === targetDisplayName) {
                    matchedFiles.push(f);
                }
                count++;
                if (count >= 100) break;
            }

            if (matchedFiles.length > 0) {
                // 假设最晚创建的是我们的文件
                matchedFiles.sort((a: any, b: any) => {
                    return new Date(b.createTime).getTime() - new Date(a.createTime).getTime();
                });
                geminiResourceName = matchedFiles[0].name;
            }
        } catch (listError) {
            console.warn("无法检索上传文件的资源名称:", listError);
        }

        return NextResponse.json({
            success: true,
            name: geminiResourceName || file.name, // 优先返回 Gemini 资源名称 (files/xxx)，降级为文件名
            originalName: file.name,
            displayName: displayName || file.name,
            sizeBytes: file.size
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
