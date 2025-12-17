"use server";

import { validateToolInputs, type ToolType } from "@/lib/tools/registry";
import type { ToolExecutionResult, ToolExecutionInput } from "./types";

// Import tool executors
import { executeWebSearch } from "./executors/webSearch";
import { executeCalculator } from "./executors/calculator";
import { executeDatetime, type DatetimeInputs } from "./executors/datetime";
// NOTE: Weather tool is hidden from UI
// import { executeWeather } from "./executors/weather";
import { executeUrlReader } from "./executors/urlReader";
import { executeCodeInterpreter, type CodeInterpreterInputs } from "./executors/codeInterpreter";

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

    // Route to the appropriate tool handler with proper type narrowing
    try {
        switch (toolType) {
            case "web_search": {
                const webSearchInputs = validation.data as { query: string; maxResults?: number };
                return await executeWebSearch(webSearchInputs);
            }

            case "calculator": {
                const calcInputs = validation.data as { expression: string };
                return await executeCalculator(calcInputs);
            }

            case "datetime": {
                const datetimeInputs = validation.data as DatetimeInputs;
                return await executeDatetime(datetimeInputs);
            }

            // NOTE: Weather tool is hidden from UI but kept for backwards compatibility
            // Legacy workflows using weather will fall through to default case

            case "url_reader": {
                const urlReaderInputs = validation.data as { url: string; maxLength?: number };
                return await executeUrlReader(urlReaderInputs);
            }

            case "code_interpreter": {
                const codeInputs = validation.data as CodeInterpreterInputs;
                return await executeCodeInterpreter(codeInputs);
            }

            default:
                return {
                    success: false,
                    error: `Unknown tool type: ${toolType}`,
                };
        }
    } catch (error) {
        console.error(`Tool execution error (${toolType}):`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Tool execution failed",
        };
    }
}
