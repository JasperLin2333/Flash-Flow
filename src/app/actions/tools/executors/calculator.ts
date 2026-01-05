import { evaluate } from "mathjs";
import type { ToolExecutionResult } from "../types";

/**
 * Execute Calculator using mathjs
 */
export async function executeCalculator(inputs: { expression: string }): Promise<ToolExecutionResult> {
    try {
        // Note: Input validation is handled by Zod schema in executeToolAction
        // Use mathjs for safe evaluation
        const result = evaluate(inputs.expression);

        return {
            success: true,
            data: {
                expression: inputs.expression,
                result,
            },
        };
    } catch (error) {
        console.error("Calculator error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to evaluate expression",
        };
    }
}
