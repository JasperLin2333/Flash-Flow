export const runtime = "nodejs";

import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { CoreMessage } from "ai";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from "@/lib/quotaEdge";
import { createSkillTool } from "@/lib/skills/skillTool";
import { formatSkillIndex } from "@/lib/skills/skillRegistry";
import { getSkillModelAllowlist, isSkillModelAllowed } from "@/lib/skills/skillGuard";

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

        const body = await reqClone.json();
        const {
            model,
            systemPrompt,
            input,
            temperature,
            conversationHistory,
            responseFormat,
            enableSkills,
            skillIds,
        } = body;

        if (!model) {
            return new Response(
                JSON.stringify({ error: "Model is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const pointsCheck = await checkPointsOnServer(req, user.id, "llm", model);
        if (!pointsCheck.allowed) {
            return pointsExceededResponse(pointsCheck.balance, pointsCheck.required);
        }

        // Construct messages with proper typing (without system prompt)
        const messages: CoreMessage[] = [];

        // Add conversation history if provided (for memory feature)
        // Security: Limit history size to prevent memory exhaustion
        const MAX_HISTORY_MESSAGES = 50;
        if (conversationHistory && Array.isArray(conversationHistory)) {
            const limitedHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
            for (const msg of limitedHistory) {
                if (msg.role && msg.content) {
                    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
                }
            }
        }

        if (input) {
            if (typeof input === "string") {
                messages.push({ role: "user", content: input });
            } else {
                messages.push({ role: "user", content: JSON.stringify(input) });
            }
        } else {
            messages.push({ role: "user", content: "" });
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

        const encoder = new TextEncoder();
        const allowedModels = getSkillModelAllowlist();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const provider = createOpenAI({
                        apiKey,
                        baseURL: config.baseURL,
                    });

                    const useSkills = enableSkills === true;
                    const modelAllowed = isSkillModelAllowed(model, allowedModels);

                    if (useSkills && !modelAllowed) {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ error: "当前模型未在技能白名单中，无法启用技能。" })}\n\n`)
                        );
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        controller.close();
                        return;
                    }
                    const allowlist = Array.isArray(skillIds) ? skillIds.filter(Boolean) : [];
                    const skillSetup = useSkills ? await createSkillTool({ scope: "runtime", allowlist }) : null;
                    const hasSkills = Boolean(skillSetup && skillSetup.skills.length > 0);
                    const skillInstructions = useSkills && hasSkills && skillSetup
                        ? [
                            formatSkillIndex(skillSetup.skills),
                            "你必须至少调用一次 `skill` 工具读取技能说明，并严格遵循技能要求的输出格式。",
                            "如果选择了多个技能，请优先选择最匹配的技能；必要时可多次调用。",
                        ].join("\n")
                        : "";
                    const effectiveSystem = [systemPrompt || "", skillInstructions].filter(Boolean).join("\n\n");

                    const tools = useSkills && hasSkills && skillSetup ? { skill: skillSetup.skillTool } : undefined;
                    const prepareStep =
                        useSkills && hasSkills && allowlist.length > 0
                            ? ({ steps }: { steps: Array<unknown> }) => {
                                if (steps.length === 0) {
                                    return { toolChoice: { type: "tool", toolName: "skill" } as const };
                                }
                                return {};
                            }
                            : undefined;
                    const stopWhen =
                        useSkills && hasSkills
                            ? ({ steps }: { steps: Array<{ toolCalls?: Array<unknown> }> }) => {
                                const hadToolCall = steps.some(step => (step.toolCalls?.length ?? 0) > 0);
                                const last = steps[steps.length - 1];
                                const lastToolCalls = last?.toolCalls?.length ?? 0;
                                if (!hadToolCall) {
                                    return steps.length >= 1;
                                }
                                return steps.length >= 2 && lastToolCalls === 0;
                            }
                            : undefined;

                    const debugEvents: Array<Record<string, unknown>> = [];

                    const result = streamText({
                        model: provider.chat(model),
                        system: effectiveSystem || undefined,
                        messages,
                        temperature: typeof temperature === "number" ? temperature : 0.7,
                        tools,
                        prepareStep,
                        stopWhen,
                        providerOptions:
                            responseFormat === "json_object"
                                ? ({ openai: { response_format: { type: "json_object" } } } as any)
                                : undefined,
                    });

                    for await (const part of result.fullStream) {
                        if (part.type === "text-delta" && part.text) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ content: part.text })}\n\n`)
                            );
                        } else if (part.type === "reasoning-delta") {
                            const reasoningChunk = (part as { delta?: string; text?: string }).delta || (part as { text?: string }).text || "";
                            if (!reasoningChunk) continue;
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ reasoning: reasoningChunk })}\n\n`)
                            );
                        } else if (part.type === "tool-input-available") {
                            debugEvents.push({
                                type: "tool-input",
                                toolName: part.toolName,
                                input: part.input,
                            });
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ debug: { type: "tool-input", toolName: part.toolName, input: part.input } })}\n\n`)
                            );
                        } else if (part.type === "tool-output-available") {
                            debugEvents.push({
                                type: "tool-output",
                                toolCallId: part.toolCallId,
                                output: part.output,
                            });
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ debug: { type: "tool-output", toolCallId: part.toolCallId, output: part.output } })}\n\n`)
                            );
                        } else if (part.type === "tool-output-error") {
                            debugEvents.push({
                                type: "tool-error",
                                toolCallId: part.toolCallId,
                                error: part.errorText,
                            });
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ debug: { type: "tool-error", toolCallId: part.toolCallId, error: part.errorText } })}\n\n`)
                            );
                        }
                    }

                    const usage = await result.totalUsage;
                    const finishReason = await result.finishReason;
                    const steps = await result.steps;
                    const toolCallCount = steps.reduce((sum, step) => sum + (step.toolCalls?.length ?? 0), 0);
                    const toolResultCount = steps.reduce((sum, step) => sum + (step.toolResults?.length ?? 0), 0);
                    await deductPointsOnServer(req, user.id, "llm", model, "LLM 使用");

                    const debugSummary = {
                        model,
                        provider,
                        useSkills,
                        hasSkills,
                        allowlist,
                        finishReason,
                        steps: steps.length,
                        toolCallCount,
                        toolResultCount,
                        events: debugEvents,
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ debugSummary })}\n\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage })}\n\n`));
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                } catch (error) {
                    if (process.env.NODE_ENV === "development") {
                        console.error("Streaming error:", error);
                    }
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Streaming failed" })}\n\n`)
                    );
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
        if (process.env.NODE_ENV === 'development') {
            console.error("Run node stream error:", error);
        }
        return new Response(
            JSON.stringify({ error: "Execution failed", details: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
