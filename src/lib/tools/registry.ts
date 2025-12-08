import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import { Search, Calculator as CalcIcon, Clock, CloudSun, Globe } from "lucide-react";

// ============ Type Definitions ============

/**
 * Available tool types in the registry
 */
export type ToolType = "web_search" | "calculator" | "datetime" | "weather" | "url_reader";

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
    category: "search" | "math" | "data" | "integration" | "utility";
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

/**
 * Datetime Tool Schema
 * Provides date/time operations: get current time, format, diff, add/subtract
 */
const datetimeSchema = z.object({
    operation: z.enum(["now", "format", "diff", "add"])
        .default("now")
        .describe("操作类型：now(获取当前时间)、format(格式化)、diff(日期差)、add(日期加减)"),
    date: z.string()
        .optional()
        .describe("输入日期（ISO 格式或常见格式），留空则使用当前时间"),
    targetDate: z.string()
        .optional()
        .describe("目标日期（用于计算日期差）"),
    format: z.string()
        .default("YYYY-MM-DD HH:mm:ss")
        .optional()
        .describe("输出格式，如 YYYY-MM-DD、HH:mm:ss 等"),
    amount: z.number()
        .optional()
        .describe("增减数量（用于日期加减）"),
    unit: z.enum(["year", "month", "day", "hour", "minute", "second"])
        .optional()
        .describe("时间单位（用于日期加减）"),
});

/**
 * Weather Tool Schema
 * Queries real-time weather for a specified city
 */
const weatherSchema = z.object({
    city: z.string()
        .min(1, "城市名称不能为空")
        .describe("请输入要查询天气的城市名称，如：北京、上海"),
});

/**
 * URL Reader Tool Schema
 * Extracts and parses main content from a web page
 */
const urlReaderSchema = z.object({
    url: z.string()
        .url("请输入有效的 URL")
        .describe("请输入要读取的网页 URL"),
    maxLength: z.number()
        .int()
        .min(100)
        .max(50000)
        .default(5000)
        .optional()
        .describe("返回内容的最大字符数（100-50000）"),
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
    datetime: {
        id: "datetime" as const,
        name: "日期时间",
        description: "获取当前时间、日期格式化、日期计算",
        icon: Clock,
        schema: datetimeSchema,
        category: "utility" as const,
    },
    weather: {
        id: "weather" as const,
        name: "天气查询",
        description: "实时查询指定城市的天气信息",
        icon: CloudSun,
        schema: weatherSchema,
        category: "data" as const,
    },
    url_reader: {
        id: "url_reader" as const,
        name: "网页读取",
        description: "提取并解析网页的正文内容",
        icon: Globe,
        schema: urlReaderSchema,
        category: "data" as const,
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
