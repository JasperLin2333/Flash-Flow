import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { model, systemPrompt, input, temperature, conversationHistory } = body;

        if (!model) {
            return NextResponse.json({ error: "Model is required" }, { status: 400 });
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

        let responseText = "";

        if (model === "qwen-flash") {
            const client = new OpenAI({
                apiKey: process.env.DASHSCOPE_API_KEY || "",
                baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
            });
            const completion = await client.chat.completions.create({
                model: "qwen-flash",
                temperature: temperature || 0.7,
                messages: messages as any,
            });
            responseText = completion.choices?.[0]?.message?.content || "";
        } else if (provider === "doubao") {
            const apiKey = process.env.DOUBAO_API_KEY || "";
            // Map common model names to Doubao specific endpoints if needed, or just pass through
            // For now, assume the UI passes the correct model ID or we default
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
                }),
            });
            if (!resp.ok) {
                const errorData = await resp.json();
                return NextResponse.json({ error: "Doubao API error", details: errorData }, { status: resp.status });
            }
            const data = await resp.json();
            responseText = data?.choices?.[0]?.message?.content || data?.output_text || "Error calling Doubao";
        } else {
            const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
            const completion = await client.chat.completions.create({
                model: model || "gpt-4o-mini",
                temperature: temperature || 0.7,
                messages: messages as any,
            });
            responseText = completion.choices?.[0]?.message?.content || "";
        }

        return NextResponse.json({ response: responseText });
    } catch (error) {
        console.error("Run node error:", error);
        return NextResponse.json({ error: "Execution failed", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
