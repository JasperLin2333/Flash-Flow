"use server";

import { validateToolInputs, type ToolType } from "@/lib/tools/registry";
import type { ToolExecutionResult, ToolExecutionInput } from "./types";

import { TOOL_EXECUTORS } from "./toolExecutorMap";

// Re-export types for external use
export type { ToolExecutionResult, ToolExecutionInput };

/**
 * Execute a tool with the given inputs
 * 
 * This is the main server action that:
 * 1. Validates inputs against the tool's Zod schema
 * 2. Routes to the appropriate tool execution handler
 * 3. Returns structured results or errors
 * 
 * @param input - Tool type and inputs
 * @returns Execution result with success status and data/error
 */
export async function executeToolAction(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    const { toolType, inputs } = input;

    // Validate inputs against the tool's schema
    const validation = validateToolInputs(toolType as ToolType, inputs);

    if (!validation.success) {
        return {
            success: false,
            error: `Invalid inputs: ${validation.error}`,
        };
    }

    // Route to the appropriate tool handler details using the executor map
    try {
        const executor = TOOL_EXECUTORS[toolType as ToolType];

        if (!executor) {
            // NOTE: Weather tool might fall here if not in the map, but it's hidden from UI
            return {
                success: false,
                error: `Unknown tool type: ${toolType}`,
            };
        }

        return await executor(validation.data);

    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`Tool execution error (${toolType}):`, error);
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : "Tool execution failed",
        };
    }
}
