import { z } from "zod";

/**
 * Relaxed Workflow Schema for LLM Structured Output Validation
 * 
 * Phase 2: Relaxed validation - only checks basic structure
 * Allows through if nodes have id/type, avoids blocking valid workflows
 */

// Basic Node Schema - relaxed
const NodeSchema = z.object({
    id: z.string().describe("Unique identifier for the node"),
    // Include all valid node types including imagegen
    type: z.enum(["input", "llm", "rag", "output", "branch", "tool", "imagegen"]).describe("Node type"),
    // Use passthrough to allow any additional data fields
    data: z.record(z.string(), z.any()).optional().default({}),
    // Position is fully optional
    position: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
    }).optional(),
}).passthrough(); // Allow additional properties

// Basic Edge Schema - relaxed
const EdgeSchema = z.object({
    id: z.string().optional(),
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
    sourceHandle: z.string().optional().nullable(),
    targetHandle: z.string().optional().nullable(),
}).passthrough(); // Allow additional properties

// Root Workflow Schema - relaxed
export const WorkflowZodSchema = z.object({
    title: z.string().optional().default("Untitled Workflow"),
    nodes: z.array(NodeSchema).describe("List of nodes in the workflow"),
    edges: z.array(EdgeSchema).optional().default([]),
}).passthrough(); // Allow additional properties

export type GeneratedWorkflow = z.infer<typeof WorkflowZodSchema>;

