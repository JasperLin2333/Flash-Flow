import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";

/**
 * Non-streaming LLM API Endpoint
 * Dynamically routes to the correct provider based on model ID
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { model, systemPrompt, input, temperature, conversationHistory } = body;

        if (!model) {
            return NextResponse.json({ error: "Model is required" }, { status: 400 });
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

        const responseText = completion.choices?.[0]?.message?.content || "";

        return NextResponse.json({ response: responseText });
    } catch (error) {
        console.error("Run node error:", error);
        return NextResponse.json({ error: "Execution failed", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

