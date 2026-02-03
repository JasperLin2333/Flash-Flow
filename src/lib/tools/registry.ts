import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import { Search, Calculator as CalcIcon, Clock, Globe, Terminal } from "lucide-react";

// ============ Type Definitions ============

/**
 * Available tool types in the registry
 */
export type ToolType = "web_search" | "calculator" | "datetime" | "url_reader" | "code_interpreter";

/**
 * Default tool type used as fallback
 */
export const DEFAULT_TOOL_TYPE: ToolType = "web_search";

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
    maxResults: z.coerce.number()
        .int()
        .min(1)
        .max(10)
        .default(5)
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
const datetimeSchema = z.discriminatedUnion("operation", [
    // 1. Now: Only optional format
    z.object({
        operation: z.literal("now").describe("操作类型"),
        format: z.string()
            .default("YYYY-MM-DD HH:mm:ss")
            .optional()
            .describe("输出格式，如 YYYY-MM-DD、HH:mm:ss 等"),
    }),

    // 2. Format: Date + Format required
    z.object({
        operation: z.literal("format").describe("操作类型"),
        date: z.string()
            .min(1, "格式化操作必须输入日期")
            .describe("输入日期（ISO 格式或常见格式）"),
        format: z.string()
            .min(1, "格式化操作必须指定输出格式")
            .default("YYYY-MM-DD HH:mm:ss")
            .describe("输出格式，如 YYYY-MM-DD、HH:mm:ss 等"),
    }),

    // 3. Diff: Date + TargetDate required, unit optional
    z.object({
        operation: z.literal("diff").describe("操作类型"),
        date: z.string()
            .min(1, "计算日期差必须输入开始日期")
            .describe("开始日期"),
        targetDate: z.string()
            .min(1, "计算日期差必须输入结束日期")
            .describe("结束日期（用于计算日期差）"),
        unit: z.enum(["year", "month", "day", "hour", "minute", "second"])
            .default("day")
            .describe("时间单位（默认为天）"),
    }),

    // 4. Add: Date + Amount + Unit required
    z.object({
        operation: z.literal("add").describe("操作类型"),
        date: z.string()
            .min(1, "日期计算必须输入基础日期")
            .describe("基础日期"),
        amount: z.coerce.number()
            .int() // Assuming integer checks are desired, otherwise just number
            .describe("增减数量（负数代表减少）"),
        unit: z.enum(["year", "month", "day", "hour", "minute", "second"])
            .describe("时间单位"),
        format: z.string()
            .default("YYYY-MM-DD HH:mm:ss")
            .optional()
            .describe("输出结果的格式"),
    }),
]);




/**
 * URL Reader Tool Schema
 * Extracts and parses main content from a web page
 */
const urlReaderSchema = z.object({
    url: z.string()
        .url("请输入有效的 URL")
        .describe("请输入要读取的网页 URL"),
    maxLength: z.coerce.number()
        .int()
        .min(100)
        .max(50000)
        .default(5000)
        .optional()
        .describe("返回内容的最大字符数（100-50000）"),
});

/**
 * Code Interpreter Tool Schema
 * Executes Python code in a secure E2B sandbox and can generate files
 */
const codeInterpreterSchema = z.object({
    code: z.string()
        .min(1, "代码不能为空")
        .describe("要执行的 Python 代码"),
    outputFileName: z.string()
        .optional()
        .describe("期望生成的输出文件名（如 output.csv、result.xlsx）"),
    inputFiles: z.array(z.object({
        name: z.string(),
        url: z.string(),
    })).optional()
        .describe("需要上传到沙箱的输入文件列表"),
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
        description: "在网上查找相关信息",
        icon: Search,
        schema: webSearchSchema,
        category: "search" as const,
    },
    calculator: {
        id: "calculator" as const,
        name: "计算器",
        description: "计算数学公式",
        icon: CalcIcon,
        schema: calculatorSchema,
        category: "math" as const,
    },
    datetime: {
        id: "datetime" as const,
        name: "日期时间",
        description: "获取当前时间 / 将日期格式化 / 计算日期",
        icon: Clock,
        schema: datetimeSchema,
        category: "utility" as const,
    },
    // NOTE: Weather tool is hidden from users but kept for reference
    // weather: {
    //     id: "weather" as const,
    //     name: "天气查询",
    //     description: "实时查询指定城市的天气信息",
    //     icon: CloudSun,
    //     schema: weatherSchema,
    //     category: "data" as const,
    // },
    url_reader: {
        id: "url_reader" as const,
        name: "网页读取",
        description: "提取并解析网页的正文内容",
        icon: Globe,
        schema: urlReaderSchema,
        category: "data" as const,
    },
    code_interpreter: {
        id: "code_interpreter" as const,
        name: "代码执行",
        description: "在安全沙箱中执行 Python 代码，可生成并返回文件",
        icon: Terminal,
        schema: codeInterpreterSchema,
        category: "utility" as const,
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

// ============ Datetime Tool Constants ============

/**
 * Datetime operation options for UI rendering
 * Used by ToolDebugDialog to dynamically render operation selector
 */
export const DATETIME_OPERATIONS = [
    { value: "now", label: "now (获取当前时间)" },
    { value: "format", label: "format (格式化日期)" },
    { value: "diff", label: "diff (计算时间差)" },
    { value: "add", label: "add (日期加减)" },
] as const;

/**
 * Time unit options for datetime tool
 */
export const TIME_UNIT_OPTIONS = [
    { value: "year", label: "年" },
    { value: "month", label: "月" },
    { value: "day", label: "日" },
    { value: "hour", label: "小时" },
    { value: "minute", label: "分" },
    { value: "second", label: "秒" },
] as const;
