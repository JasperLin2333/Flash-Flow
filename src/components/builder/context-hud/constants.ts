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
    // Branch node specific fields
    condition: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

// ============ Default Values ============
export const DEFAULT_MODEL = "qwen-flash";
export const DEFAULT_TEMPERATURE = 0.7;

// ============ Style Constants ============
export const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
export const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

// ============ Node Output Field Definitions ============
export const NODE_OUTPUT_FIELDS: Record<NodeKind, { field: string; description: string }[]> = {
    input: [
        { field: "user_input", description: "用户输入的文本内容" },
        { field: "timestamp", description: "输入时间戳" },
        { field: "files", description: "上传的文件列表，通过 files[n].name/type/size/url 访问" },
        { field: "formData", description: "结构化表单对象，通过 formData.字段名 访问" },
    ],
    llm: [
        { field: "response", description: "AI 生成的回复内容" },
    ],
    rag: [
        { field: "query", description: "检索查询文本" },
        { field: "documents", description: "检索到的文档片段数组" },
        { field: "citations", description: "引用信息" },
    ],
    tool: [], // 动态根据工具类型生成
    branch: [
        { field: "conditionResult", description: "条件判断结果 (true/false)" },
    ],
    output: [
        { field: "text", description: "最终输出文本" },
    ],
};

// ============ Tool Specific Definitions ============
export const TOOL_IO_DEFINITIONS: Record<string, ToolIODefinition> = {
    web_search: {
        inputs: [
            { field: "query", description: "搜索查询内容", required: true },
            { field: "maxResults", description: "最大返回结果数", required: false },
        ],
        outputs: [
            { field: "results", description: "搜索结果数组" },
            { field: "count", description: "结果数量" },
        ],
    },
    calculator: {
        inputs: [
            { field: "expression", description: "数学表达式", required: true },
        ],
        outputs: [
            { field: "expression", description: "计算表达式" },
            { field: "result", description: "计算结果" },
        ],
    },
    datetime: {
        inputs: [
            { field: "operation", description: "操作类型 (now/format/diff/add)", required: false },
            { field: "date", description: "输入日期", required: false },
            { field: "format", description: "输出格式", required: false },
        ],
        outputs: [
            { field: "formatted", description: "格式化后的日期时间" },
            { field: "timestamp", description: "时间戳" },
            { field: "timezone", description: "时区" },
        ],
    },
    weather: {
        inputs: [
            { field: "city", description: "城市名称", required: true },
        ],
        outputs: [
            { field: "city", description: "城市名" },
            { field: "weather", description: "天气信息对象" },
            { field: "summary", description: "天气概要文本" },
        ],
    },
    url_reader: {
        inputs: [
            { field: "url", description: "网页 URL", required: true },
            { field: "maxLength", description: "最大返回字符数", required: false },
        ],
        outputs: [
            { field: "url", description: "网页地址" },
            { field: "title", description: "页面标题" },
            { field: "content", description: "提取的正文内容" },
        ],
    },
};

// ============ 节点需要的上游输入（不包括已有表单配置的参数） ============
// 注意：systemPrompt、model、temperature 等已在表单中配置，这里只显示需要从上游获取的数据
// Output 节点使用专用的 OutputNodeConfig 组件配置
export const NODE_UPSTREAM_INPUTS: Record<NodeKind, { field: string; description: string; required: boolean }[]> = {
    input: [],  // 入口节点，无需上游输入
    llm: [
        { field: "user_input", description: "用户消息内容", required: true },
    ],
    rag: [
        { field: "query", description: "检索查询文本", required: true },
        { field: "files", description: "动态文件引用（可选，如 {{输入节点.files}}）", required: false },
    ],
    tool: [], // 动态根据工具类型生成
    branch: [],  // condition 表达式已说明数据来源
    output: [], // 使用 OutputNodeConfig 组件配置
};
