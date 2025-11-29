import { z } from "zod";

export const PlanRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt cannot be empty").max(1000, "Prompt is too long"),
    ownerId: z.string().optional(), // We will ignore this in the backend and use the auth user instead
});

export const NodeSchema = z.object({
    id: z.string(),
    type: z.enum(["input", "llm", "rag", "http", "output", "branch"]),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    data: z.record(z.string(), z.unknown()),
});

export const EdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
});

export const FlowDataSchema = z.object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
});
