import { NextResponse } from "next/server";
export const runtime = 'edge';
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from "@/lib/quotaEdge";

/**
 * Non-streaming LLM API Endpoint
 * Dynamically routes to the correct provider based on model ID
 */
export async function POST(req: Request) {
    // Clone request for quota operations
    const reqClone = req.clone();

    try {
        // Authentication check
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return unauthorizedResponse();
        }

        const body = await reqClone.json();
        const { model, systemPrompt, input, temperature, conversationHistory } = body;

        if (!model) {
            return NextResponse.json({ error: "Model is required" }, { status: 400 });
        }

        const pointsCheck = await checkPointsOnServer(req, user.id, "llm", model);
        if (!pointsCheck.allowed) {
            return pointsExceededResponse(pointsCheck.balance, pointsCheck.required);
        }

        // Construct messages with proper typing
        const messages: ChatCompletionMessageParam[] = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

        // Add conversation history if provided (for memory feature)
        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory) {
                if (msg.role && msg.content) {
                    messages.push({ role: msg.role, content: msg.content });
                }
            }
        }

        if (input) {
            if (typeof input === 'string') {
                messages.push({ role: "user", content: input });
            } else {
                messages.push({ role: "user", content: JSON.stringify(input) });
            }
        } else {
            messages.push({ role: "user", content: "Start" });
        }

        // Determine provider based on model
        const provider = getProviderForModel(model);
        const config = PROVIDER_CONFIG[provider];

        // Validate API key is configured
        const apiKey = config.getApiKey();
        if (!apiKey) {
            return NextResponse.json(
                { error: `API key for ${provider} is not configured. Please set the corresponding environment variable.` },
                { status: 500 }
            );
        }

        // Create OpenAI client for the selected provider
        const client = new OpenAI({
            apiKey,
            baseURL: config.baseURL,
        });

        const completion = await client.chat.completions.create({
            model: model,
            temperature: temperature || 0.7,
            messages,
        });

        const message = completion.choices?.[0]?.message;
        const responseText = message?.content || "";
        // @ts-expect-error reasoning_content is model-specific
        const reasoningText = message?.reasoning_content || "";

        await deductPointsOnServer(req, user.id, "llm", model, "LLM 使用");

        return NextResponse.json({
            response: responseText,
            reasoning: reasoningText
        });
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error("Run node error:", error);
        }
        return NextResponse.json({ error: "Execution failed", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
