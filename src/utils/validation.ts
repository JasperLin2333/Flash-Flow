import { z } from "zod";
import type { NodeKind } from "@/types/flow";

/**
 * 节点类型列表
 * 注意: 与 types/flow.ts 中的 NodeKind 类型保持同步
 * TODO: 考虑从类型定义中动态生成此列表
 */
const NODE_TYPES: readonly NodeKind[] = ["input", "llm", "rag", "output", "branch", "tool"] as const;

export const PlanRequestSchema = z.object({
    prompt: z.string().min(1, "Prompt cannot be empty").max(1000, "Prompt is too long"),
    ownerId: z.string().optional(), // We will ignore this in the backend and use the auth user instead
});

export const NodeSchema = z.object({
    id: z.string(),
    type: z.enum(NODE_TYPES as unknown as [string, ...string[]]),
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
