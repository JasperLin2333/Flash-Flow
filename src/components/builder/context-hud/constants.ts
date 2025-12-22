import * as z from "zod";
import type { NodeKind } from "@/types/flow";
import type { ToolIODefinition } from "./types";

// ============ Form Schema ============
export const formSchema = z.object({
    label: z.string().min(1, "Label is required"),
    model: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    systemPrompt: z.string().optional(),
    text: z.string().optional(),
    toolType: z.string().optional(),
    inputs: z.record(z.string(), z.any()).optional(),
    // LLM node specific fields
    enableMemory: z.boolean().optional(),
    memoryMaxTurns: z.number().min(1).max(20).optional(),
    // Input node specific fields
    enableTextInput: z.boolean().optional(),
    enableFileInput: z.boolean().optional(),
    enableStructuredForm: z.boolean().optional(),
    fileConfig: z.object({
        allowedTypes: z.array(z.string()),
        maxSizeMB: z.number(),
        maxCount: z.number(),
    }).optional(),
    formFields: z.array(z.any()).optional(),
    greeting: z.string().optional(),  // 招呼语
    // Branch node specific fields
    condition: z.string().optional(),
});


export type FormValues = z.infer<typeof formSchema>;

// ============ Default Values ============
export const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";
export const DEFAULT_TEMPERATURE = 0.7;

// ============ Style Constants ============
export const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
export const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

// ============ Node Output Field Definitions ============
export const NODE_OUTPUT_FIELDS: Record<NodeKind, { field: string; description: string }[]> = {
    input: [
        { field: "user_input", description: "用户输入的文本内容" },

        { field: "files", description: "用户上传的文件列表，可通过 files[n] 获取单个文件" },
        { field: "formData", description: "结构化表单，通过 formData.字段名 引用" },
    ],
    llm: [
        { field: "response", description: "AI生成的回复内容" },
    ],
    rag: [
        { field: "documents", description: "文件中找到的相关内容" },
        { field: "citations", description: "引用信息" },
    ],
    tool: [], // 动态根据工具类型生成
    branch: [
        { field: "conditionResult", description: "条件判断结果 (true/false)" },
    ],
    output: [
        { field: "text", description: "最终输出的文本内容" },
    ],
};

// ============ Tool Specific Definitions ============
export const TOOL_IO_DEFINITIONS: Record<string, ToolIODefinition> = {
    web_search: {
        inputs: [
            { field: "query", description: "搜索内容", required: true },
            { field: "maxResults", description: "最多找多少个网页", required: false },
        ],
        outputs: [
            { field: "results", description: "搜索的结果" },
            { field: "count", description: "找了多少个网页" },
        ],
    },
    calculator: {
        inputs: [
            { field: "expression", description: "数学公式", required: true },
        ],
        outputs: [
            { field: "expression", description: "数学公式" },
            { field: "result", description: "计算结果" },
        ],
    },
    datetime: {
        inputs: [
            { 
                field: "operation", 
                required: false,
                type: "enum" as const,
                enumOptions: ["now（获取当前时间）", "format（日期格式化）", "diff（计算日期差）", "add（日期加减）"],
            },
            { 
                field: "date", 
                description: "输入日期（ISO 格式或常见格式）", 
                required: false,
            },
            { 
                field: "format", 
                description: "输出的日期格式（如 YYYY-MM-DD HH:mm:ss）", 
                required: false,
            },
            { 
                field: "targetDate", 
                description: "目标日期（用于计算日期差）", 
                required: false,
                dependsOn: { field: "operation", value: "diff" },
            },
            { 
                field: "amount", 
                description: "增减数量（用于日期加减）", 
                required: false,
                type: "number" as const,
                dependsOn: { field: "operation", value: "add" },
            },
            { 
                field: "unit", 
                description: "时间单位（用于日期加减）", 
                required: false,
                type: "enum" as const,
                enumOptions: ["year", "month", "day", "hour", "minute", "second"],
                dependsOn: { field: "operation", value: "add" },
            },
        ],
        outputs: [
            { field: "formatted", description: "格式化后的日期时间" },
            { field: "timestamp", description: "时间戳" },
            { field: "timezone", description: "时区" },
        ],
    },
    // NOTE: Weather tool is hidden from users
    // weather: {
    //     inputs: [
    //         { field: "city", description: "城市名称", required: true },
    //     ],
    //     outputs: [
    //         { field: "city", description: "城市名" },
    //         { field: "weather", description: "天气信息对象" },
    //         { field: "summary", description: "天气概要文本" },
    //     ],
    // },
    url_reader: {
        inputs: [
            { field: "url", description: "想要读取的网页地址", required: true },
            { field: "maxLength", description: "最多返回多少字", required: false },
        ],
        outputs: [
            { field: "url", description: "网页地址" },
            { field: "title", description: "网页标题" },
            { field: "content", description: "提取的网页正文内容" },
        ],
    },
    code_interpreter: {
        inputs: [
            { field: "code", description: "要执行的 Python 代码", required: true },
            { field: "inputFiles", description: "上传希望被处理的文件", required: false },
            { field: "outputFileName", description: "期望生成的输出文件名，如 output.csv", required: false },
        ],
        outputs: [
            { field: "logs", description: "代码执行的标准输出日志" },
            { field: "errors", description: "代码执行的错误输出" },
            { field: "generatedFile", description: "生成的文件 {包含name, url, type}" },
            { field: "result", description: "代码执行返回的内容" },
        ],
    },
};

// ============ 节点需要的上游输入（不包括已有表单配置的参数） ============
// 注意：systemPrompt、model、temperature 等已在表单中配置，这里只显示需要从上游获取的数据
// Output 节点使用专用的 OutputNodeConfig 组件配置
export const NODE_UPSTREAM_INPUTS: Record<NodeKind, { field: string; description: string; required: boolean }[]> = {
    input: [],  // 入口节点，无需上游输入
    llm: [
        { field: "user_input", description: "用户提示词", required: false },
    ],
    rag: [
        { field: "query", description: "想要从文件中找出什么", required: true },
        { field: "files", description: "动态文件引用（APP页面上传的文件）", required: false },
    ],
    tool: [], // 动态根据工具类型生成
    branch: [],  // condition 表达式已说明数据来源
    output: [], // 使用 OutputNodeConfig 组件配置
};
