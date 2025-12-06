import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import { Search, Calculator as CalcIcon } from "lucide-react";

// ============ Type Definitions ============

/**
 * Available tool types in the registry
 */
export type ToolType = "web_search" | "calculator";

/**
 * Zod schema type helper - extracts input type from schema
 */
export type ToolInputs<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * Tool configuration interface
 * Each tool must define its id, metadata, and Zod schema for validation
 */
export interface ToolConfig<T extends z.ZodTypeAny = z.ZodTypeAny> {
    id: ToolType;
    name: string;
    description: string;
    icon: LucideIcon;
    schema: T;
    category: "search" | "math" | "data" | "integration";
}

// ============ Tool Schemas ============

/**
 * Web Search Tool Schema
 * Uses Tavily API for semantic web search
 */
const webSearchSchema = z.object({
    query: z.string()
        .min(1, "Query is required")
        .describe("请在此输入你想要搜索的内容"),
    maxResults: z.number()
        .int()
        .min(1)
        .max(10)
        .default(5)
        .optional()
        .describe("请在此输入你期望搜索内容的最大数量 (1-10)"),
});

/**
 * Calculator Tool Schema
 * Evaluates mathematical expressions safely
 */
const calculatorSchema = z.object({
    expression: z.string()
        .min(1, "Expression is required")
        .describe("请在此输入你想要计算的表达式"),
});

// ============ Tool Registry ============

/**
 * Central Tool Registry
 * 
 * This is the single source of truth for all available tools.
 * To add a new tool:
 * 1. Define its Zod schema above
 * 2. Add a new entry here with id, name, description, icon, and schema
 * 3. Implement the execution logic in app/actions/tools.ts
 * 
 * The schema is used for:
 * - Frontend form validation
 * - Backend type inference
 * - Dynamic UI rendering
 */
export const TOOL_REGISTRY = {
    web_search: {
        id: "web_search" as const,
        name: "网页搜索",
        description: "使用 Tavily 搜索引擎联网查找相关信息",
        icon: Search,
        schema: webSearchSchema,
        category: "search" as const,
    },
    calculator: {
        id: "calculator" as const,
        name: "计算器",
        description: "安全计算数学表达式",
        icon: CalcIcon,
        schema: calculatorSchema,
        category: "math" as const,
    },
} as const satisfies Record<ToolType, ToolConfig>;

// ============ Utility Types ============

/**
 * Get all tool IDs as a union type
 */
export type ToolId = keyof typeof TOOL_REGISTRY;

/**
 * Get the config for a specific tool
 */
export type GetToolConfig<T extends ToolId> = typeof TOOL_REGISTRY[T];

/**
 * Get the input schema type for a specific tool
 */
export type GetToolInputs<T extends ToolId> = ToolInputs<GetToolConfig<T>["schema"]>;

// ============ Helper Functions ============

/**
 * Get a tool configuration by ID
 * @param toolId - The tool identifier
 * @returns The tool configuration or undefined if not found
 */
export function getToolConfig(toolId: string): ToolConfig | undefined {
    return TOOL_REGISTRY[toolId as ToolType];
}

/**
 * Get all available tool IDs
 * @returns Array of tool IDs
 */
export function getAllToolIds(): ToolType[] {
    return Object.keys(TOOL_REGISTRY) as ToolType[];
}

/**
 * Validate tool inputs against the tool's schema
 * @param toolId - The tool identifier
 * @param inputs - The inputs to validate
 * @returns Validation result with parsed data or errors
 */
export function validateToolInputs(toolId: ToolType, inputs: unknown) {
    const config = TOOL_REGISTRY[toolId];
    if (!config) {
        return { success: false as const, error: `Unknown tool: ${toolId}` };
    }

    const result = config.schema.safeParse(inputs);
    if (!result.success) {
        return {
            success: false as const,
            error: result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
        };
    }

    return { success: true as const, data: result.data };
}
