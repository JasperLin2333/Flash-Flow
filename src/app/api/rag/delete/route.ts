import { NextResponse } from "next/server";
export const runtime = 'edge';
import { GoogleGenAI } from '@google/genai';
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";

// ============ Types ============
interface DeleteRequest {
    fileName: string;  // 文件资源名称（如 "files/abc123"）
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

        const body: DeleteRequest = await req.json();
        const { fileName } = body;

        if (!fileName || !fileName.trim()) {
            return NextResponse.json(
                { error: "文件名不能为空" },
                { status: 400 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        // Delete the file from Gemini
        await ai.files.delete({ name: fileName });

        return NextResponse.json({ success: true });

    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error("[RAG Delete API] Error:", error);
        }

        // File might already be deleted or not exist - treat as success
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND')) {
            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { error: errorMessage || "删除失败" },
            { status: 500 }
        );
    }
}
