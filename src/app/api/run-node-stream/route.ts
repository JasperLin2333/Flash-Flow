import OpenAI from "openai";
export const runtime = 'edge';
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkQuotaOnServer, incrementQuotaOnServer, quotaExceededResponse } from "@/lib/quotaEdge";

/**
 * Streaming LLM API Endpoint
 * Dynamically routes to the correct provider based on model ID
 */
export async function POST(req: Request) {
    // Clone request for quota operations (body can only be read once)
    const reqClone = req.clone();

    try {
        // Authentication check
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return unauthorizedResponse();
        }

        // Server-side quota check
        const quotaCheck = await checkQuotaOnServer(req, user.id, "llm_executions");
        if (!quotaCheck.allowed) {
            return quotaExceededResponse(quotaCheck.used, quotaCheck.limit, "LLM 执行次数");
        }

        const body = await reqClone.json();
        const { model, systemPrompt, input, temperature, conversationHistory } = body;

        if (!model) {
            return new Response(
                JSON.stringify({ error: "Model is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Construct messages with proper typing
        const messages: ChatCompletionMessageParam[] = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

        // Add conversation history if provided (for memory feature)
        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory) {
                if (msg.role && msg.content) {
                    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
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
            return new Response(
                JSON.stringify({ error: `API key for ${provider} is not configured. Please set the corresponding environment variable.` }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Create streaming response
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const client = new OpenAI({
                        apiKey,
                        baseURL: config.baseURL,
                    });

                    const completion = await client.chat.completions.create({
                        model: model,
                        temperature: temperature || 0.7,
                        messages,
                        stream: true,
                    });

                    for await (const chunk of completion) {
                        const delta = chunk.choices?.[0]?.delta;
                        const content = delta?.content || "";
                        // @ts-ignore - reasoning_content is specific to some models like DeepSeek
                        const reasoning = delta?.reasoning_content || "";

                        if (content || reasoning) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, reasoning })}\n\n`));
                        }
                    }

                    // Increment quota after successful completion
                    await incrementQuotaOnServer(req, user.id, "llm_executions");

                    // Signal stream end
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                } catch (error) {
                    console.error("Streaming error:", error);
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Streaming failed" })}\n\n`)
                    );
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (error) {
        console.error("Run node stream error:", error);
        return new Response(
            JSON.stringify({ error: "Execution failed", details: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
