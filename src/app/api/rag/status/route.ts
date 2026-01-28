
import { NextResponse } from "next/server";
import { GoogleGenAI } from '@google/genai';
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";

export const runtime = 'nodejs';

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

        const body = await req.json();
        const { operationName, displayName } = body;

        if (!operationName) {
            return NextResponse.json(
                { error: "Missing operationName" },
                { status: 400 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });
        
        // Check operation status
        const operation = await ai.operations.get({ operation: operationName });

        // Workaround for @google/genai SDK bug: 
        // Sometimes operation.done is undefined or false even when indexing is finished.
        // If operation.response.documentName exists, it means indexing is successful.
        const isDone = operation.done === true || !!(operation.response as any)?.documentName;

        if (isDone && !operation.error) {
            // Operation completed successfully
            let geminiResourceName = (operation.response as any)?.documentName || (operation.response as any)?.name || "";
            
            // If still no resource name, use displayName as fallback but log warning
            if (!geminiResourceName) {
                console.warn("[RAG Status] Operation done but no resource name found in response:", operation);
                geminiResourceName = displayName;
            }

            return NextResponse.json({
                done: true,
                result: {
                    name: geminiResourceName,
                    displayName: displayName
                }
            });
        }

        return NextResponse.json({
            done: isDone,
            error: operation.error,
            metadata: operation.metadata
        });

    } catch (error) {
        console.error("Check operation status failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "状态查询失败" },
            { status: 500 }
        );
    }
}
