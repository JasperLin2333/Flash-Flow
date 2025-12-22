import { z } from "zod";

/**
 * Strict Workflow Schema for LLM Structured Output Validation
 * 
 * Ensures the generated JSON matches the expected structure for the Flow builder.
 */

// Basic Node Schema
const NodeSchema = z.object({
    id: z.string().describe("Unique identifier for the node"),
    type: z.enum(["input", "llm", "rag", "output", "branch", "tool"]).describe("Node type"),
    data: z.record(z.string(), z.any()).describe("Node configuration data"),
    // Position is optional in generation, UI can auto-layout, but good to have constraint if model provides it
    position: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
    }).optional(),
});

// Basic Edge Schema
const EdgeSchema = z.object({
    id: z.string().optional().describe("Unique identifier for the edge (optional, can be auto-generated)"),
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
});

// Root Workflow Schema
export const WorkflowZodSchema = z.object({
    title: z.string().describe("The name of the workflow"),
    nodes: z.array(NodeSchema).describe("List of nodes in the workflow"),
    edges: z.array(EdgeSchema).describe("List of edges connecting the nodes"),
});

export type GeneratedWorkflow = z.infer<typeof WorkflowZodSchema>;
