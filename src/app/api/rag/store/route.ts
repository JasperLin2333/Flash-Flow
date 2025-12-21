import { NextResponse } from "next/server";
export const runtime = 'edge';
import { GoogleGenAI } from '@google/genai';
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";

// ============ Types ============
interface CreateStoreRequest {
    displayName: string;
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

        const body: CreateStoreRequest = await req.json();
        const { displayName } = body;

        if (!displayName || !displayName.trim()) {
            return NextResponse.json(
                { error: "Store 名称不能为空" },
                { status: 400 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        const fileSearchStore = await ai.fileSearchStores.create({
            config: { displayName }
        });

        const storeName = fileSearchStore.name;
        if (!storeName) {
            return NextResponse.json(
                { error: "创建 FileSearchStore 失败：未返回名称" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            name: storeName,
            displayName: fileSearchStore.displayName,
            createTime: fileSearchStore.createTime
        });

    } catch (error) {
        console.error("[RAG Store API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "创建 Store 失败" },
            { status: 500 }
        );
    }
}
