import { NextResponse } from "next/server";
import { detectUserIntent } from "@/lib/agent/intentRecognition";

export const runtime = 'edge';

/**
 * API: /api/intent-router
 * 
 * Lightweight endpoint for routing user intent BEFORE entering the heavy Agent overlay.
 * This enables the frontend to decide whether to:
 * - PLAN_MODE: Open full Agent Overlay with planning/clarification flow
 * - DIRECT_MODE: Proceed directly to generation (skipping confirmation)
 * 
 * Note: This is different from /api/classify-intent which classifies workflow modification intents.
 */

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt?.trim()) {
            return NextResponse.json(
                { error: "Prompt is required", mode: "PLAN_MODE" },
                { status: 400 }
            );
        }

        const result = await detectUserIntent(prompt);

        return NextResponse.json({
            mode: result.mode,
            confidence: result.confidence,
        });
    } catch (error) {
        console.error("[intent-router] Error:", error);
        // On error, default to PLAN_MODE (safer)
        return NextResponse.json({
            mode: "PLAN_MODE",
            confidence: "low",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
