import OpenAI from "openai";

/**
 * Streaming LLM API Endpoint
 * Returns Server-Sent Events for real-time token streaming
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { model, systemPrompt, input, temperature, conversationHistory } = body;

        if (!model) {
            return new Response(
                JSON.stringify({ error: "Model is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();

        // Construct messages
        const messages: { role: string; content: string }[] = [];
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

        // Create streaming response
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    if (model === "qwen-flash") {
                        // Qwen with OpenAI-compatible API
                        const client = new OpenAI({
                            apiKey: process.env.DASHSCOPE_API_KEY || "",
                            baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
                        });

                        const completion = await client.chat.completions.create({
                            model: "qwen-flash",
                            temperature: temperature || 0.7,
                            messages: messages as any,
                            stream: true,
                        });

                        for await (const chunk of completion) {
                            const content = chunk.choices?.[0]?.delta?.content || "";
                            if (content) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                            }
                        }
                    } else if (provider === "doubao") {
                        // Doubao API with streaming
                        const apiKey = process.env.DOUBAO_API_KEY || "";
                        const actualModel = model === "gpt-4" ? (process.env.DOUBAO_MODEL || "doubao-pro-128k") : model;

                        const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${apiKey}`,
                            },
                            body: JSON.stringify({
                                model: actualModel,
                                messages,
                                temperature: temperature || 0.7,
                                stream: true,
                            }),
                        });

                        if (!resp.ok || !resp.body) {
                            throw new Error(`Doubao API failed: ${resp.status}`);
                        }

                        const reader = resp.body.getReader();
                        const decoder = new TextDecoder();
                        let buffer = "";

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split("\n");
                            buffer = lines.pop() || "";

                            for (const line of lines) {
                                if (line.startsWith("data: ")) {
                                    const data = line.slice(6);
                                    if (data === "[DONE]") continue;
                                    try {
                                        const parsed = JSON.parse(data);
                                        const content = parsed.choices?.[0]?.delta?.content || "";
                                        if (content) {
                                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                                        }
                                    } catch {
                                        // Skip malformed JSON
                                    }
                                }
                            }
                        }
                    } else {
                        // OpenAI API
                        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
                        const completion = await client.chat.completions.create({
                            model: model || "gpt-4o-mini",
                            temperature: temperature || 0.7,
                            messages: messages as any,
                            stream: true,
                        });

                        for await (const chunk of completion) {
                            const content = chunk.choices?.[0]?.delta?.content || "";
                            if (content) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                            }
                        }
                    }

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
