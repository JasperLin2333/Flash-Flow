import { z } from "zod";
import { tool } from "ai";
import { WorkflowZodSchema } from "@/lib/schemas/workflow";
import {
    BEST_PRACTICES,
    INTENT_KEYWORDS,
    detectIntentFromPrompt,
    getProactiveSuggestions,
    type ScenarioType
} from "./bestPractices";

/**
 * Agent Tools for Flash Flow MVP
 * 
 * These tools allow the Agent to validate its own output and access schema information.
 * Uses Vercel AI SDK v5 `tool()` helper with `inputSchema`.
 */

// ============ Validate Flow Tool ============
export const validateFlowTool = tool({
    description: `Validate a generated workflow JSON structure. Use this tool AFTER generating a workflow to ensure it is valid before returning to the user. This checks:
- Required fields (id, type, data) for each node
- Edge validity (source/target nodes exist)
- Node type-specific requirements (e.g., LLM must have systemPrompt)
Returns validation result with specific errors if any.`,
    inputSchema: z.object({
        workflow: z.object({
            title: z.string().optional(),
            nodes: z.array(z.any()),
            edges: z.array(z.any()),
        }).describe("The workflow JSON to validate"),
    }),
    execute: async ({ workflow }) => {
        const errors: string[] = [];
        const nodeIds = new Set<string>();

        // Validate nodes
        if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
            errors.push("Missing or invalid nodes array");
            return { valid: false, errors };
        }

        for (let i = 0; i < workflow.nodes.length; i++) {
            const node = workflow.nodes[i] as Record<string, unknown>;
            const prefix = `Node[${i}]`;

            // Check required fields
            if (!node.id) errors.push(`${prefix}: Missing 'id'`);
            else nodeIds.add(node.id as string);

            if (!node.type) errors.push(`${prefix}: Missing 'type'`);

            const validTypes = ["input", "llm", "rag", "output", "branch", "tool", "imagegen"];
            if (node.type && !validTypes.includes(node.type as string)) {
                errors.push(`${prefix}: Invalid type '${node.type}'. Valid: ${validTypes.join(", ")}`);
            }

            if (!node.data) errors.push(`${prefix}: Missing 'data' object`);

            const data = node.data as Record<string, unknown> | undefined;

            // Type-specific validation
            if (node.type === "llm" && data) {
                if (!data.systemPrompt) {
                    errors.push(`${prefix} (LLM): Missing 'systemPrompt' in data`);
                }
                if (!data.model) {
                    errors.push(`${prefix} (LLM): Missing 'model' in data`);
                }
                if (!data.label) {
                    errors.push(`${prefix} (LLM): Missing 'label' in data`);
                }
            }

            if (node.type === "input" && data) {
                if (!data.label) {
                    errors.push(`${prefix} (Input): Missing 'label' in data`);
                }
            }

            if (node.type === "output" && data) {
                if (!data.label) {
                    errors.push(`${prefix} (Output): Missing 'label' in data`);
                }
                if (!data.inputMappings) {
                    errors.push(`${prefix} (Output): Missing 'inputMappings' in data`);
                }
            }

            if (node.type === "branch" && data) {
                if (!data.condition) {
                    errors.push(`${prefix} (Branch): Missing 'condition' in data`);
                }
            }

            if (node.type === "tool" && data) {
                if (!data.toolType) {
                    errors.push(`${prefix} (Tool): Missing 'toolType' in data`);
                }
            }
        }

        // Validate edges
        if (workflow.edges && Array.isArray(workflow.edges)) {
            for (let i = 0; i < workflow.edges.length; i++) {
                const edge = workflow.edges[i] as Record<string, unknown>;
                const prefix = `Edge[${i}]`;

                if (!edge.source) errors.push(`${prefix}: Missing 'source'`);
                if (!edge.target) errors.push(`${prefix}: Missing 'target'`);

                if (edge.source && !nodeIds.has(edge.source as string)) {
                    errors.push(`${prefix}: source '${edge.source}' does not exist in nodes`);
                }
                if (edge.target && !nodeIds.has(edge.target as string)) {
                    errors.push(`${prefix}: target '${edge.target}' does not exist in nodes`);
                }
            }
        }

        // Schema validation using Zod
        const zodResult = WorkflowZodSchema.safeParse(workflow);
        if (!zodResult.success) {
            zodResult.error.issues.forEach(issue => {
                errors.push(`Schema: ${issue.path.join(".")} - ${issue.message}`);
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            nodeCount: workflow.nodes?.length || 0,
            edgeCount: workflow.edges?.length || 0,
        };
    },
});

// ============ Get Node Schema Reference Tool ============
export const getNodeSchemaTool = tool({
    description: `Get the schema reference for a specific node type. Use this when you need to understand the exact data structure required for a node type. Returns TypeScript interface and usage examples.`,
    inputSchema: z.object({
        nodeType: z.enum(["input", "llm", "rag", "output", "branch", "tool", "imagegen"])
            .describe("The type of node to get schema for"),
    }),
    execute: async ({ nodeType }) => {
        const schemas: Record<string, { interface: string; example: object; tips: string[] }> = {
            input: {
                interface: `{
  label: string;           // 必填
  greeting?: string;
  enableTextInput?: boolean;  // 默认 true
  enableFileInput?: boolean;  // 配合 fileConfig
  enableStructuredForm?: boolean; // 配合 formFields
  fileConfig?: { allowedTypes: string[], maxSizeMB: number, maxCount: number };
  formFields?: Array<{ type: "text"|"select"|"multi-select", name: string, label: string, ... }>;
}`,
                example: {
                    id: "input_1",
                    type: "input",
                    data: {
                        label: "用户输入",
                        greeting: "请输入您的需求",
                        enableTextInput: true,
                    },
                },
                tips: [
                    "输出变量: {{Input.user_input}}, {{Input.files}}, {{Input.formData.字段名}}",
                    "enableFileInput 必须配合 fileConfig 使用",
                ],
            },
            llm: {
                interface: `{
  label: string;           // 必填
  model: string;           // 必填，如 "deepseek-chat"
  systemPrompt: string;    // 必填，支持 {{变量}} 引用
  temperature?: number;    // 0.0-1.0，默认 0.7
  enableMemory?: boolean;
  memoryMaxTurns?: number;
  responseFormat?: "text" | "json_object";
  inputMappings?: { user_input?: string };
}`,
                example: {
                    id: "llm_1",
                    type: "llm",
                    data: {
                        label: "AI助手",
                        model: "deepseek-chat",
                        systemPrompt: "你是一个专业的翻译助手。根据用户输入进行翻译。",
                        temperature: 0.7,
                        inputMappings: { user_input: "{{Input.user_input}}" },
                    },
                },
                tips: [
                    "输出变量: {{LLM.response}}",
                    "JSON模式时: {{LLM.response.字段名}}",
                    "推荐模型: deepseek-chat (通用), qwen-flash (快速)",
                ],
            },
            output: {
                interface: `{
  label: string;
  inputMappings: {
    mode: "direct" | "select" | "merge" | "template";
    sources?: Array<{ type: "variable"|"static", value: string }>;
    template?: string;  // mode=template 时必填
    attachments?: Array<{ type: "variable", value: string }>;
  };
}`,
                example: {
                    id: "output_1",
                    type: "output",
                    data: {
                        label: "输出",
                        inputMappings: {
                            mode: "direct",
                            sources: [{ type: "variable", value: "{{LLM.response}}" }],
                        },
                    },
                },
                tips: [
                    "mode=direct 适用于单一 LLM 输出",
                    "图片附件: attachments: [{type:'variable', value:'{{ImageGen.imageUrl}}'}]",
                ],
            },
            branch: {
                interface: `{
  label: string;
  condition: string;  // 条件表达式，如 "{{LLM.response}}.includes('成功')"
}`,
                example: {
                    id: "branch_1",
                    type: "branch",
                    data: {
                        label: "判断结果",
                        condition: "{{LLM.response.status}} === 'success'",
                    },
                },
                tips: [
                    "输出 handle: 'true' 和 'false'",
                    "支持: >, <, ===, .includes(), &&, ||",
                ],
            },
            tool: {
                interface: `{
  label: string;
  toolType: "web_search" | "url_reader" | "calculator" | "datetime" | "code_interpreter";
  inputs: { ... };  // 根据 toolType 不同
}`,
                example: {
                    id: "tool_1",
                    type: "tool",
                    data: {
                        label: "联网搜索",
                        toolType: "web_search",
                        inputs: { query: "{{Input.user_input}}", maxResults: 5 },
                    },
                },
                tips: [
                    "web_search 输出: {{Tool.results}}, {{Tool.count}}",
                    "calculator 输出: {{Tool.result}}",
                ],
            },
            rag: {
                interface: `{
  label: string;
  fileMode?: "variable" | "static";
  inputMappings?: { query?: string, files?: string };
  maxTokensPerChunk?: number;
  maxOverlapTokens?: number;
}`,
                example: {
                    id: "rag_1",
                    type: "rag",
                    data: {
                        label: "知识检索",
                        fileMode: "variable",
                        inputMappings: {
                            query: "{{Input.user_input}}",
                            files: "{{Input.files}}",
                        },
                    },
                },
                tips: ["输出变量: {{RAG.documents}}"],
            },
            imagegen: {
                interface: `{
  label: string;
  model: string;  // "Kwai-Kolors/Kolors" 或 "Qwen/Qwen-Image"
  prompt: string;
  negativePrompt?: string;
  imageSize?: string;  // "1024x1024" 等
  cfg?: number;
  numInferenceSteps?: number;
  referenceImageMode?: "variable" | "static";
  referenceImageVariable?: string;
}`,
                example: {
                    id: "imagegen_1",
                    type: "imagegen",
                    data: {
                        label: "图片生成",
                        model: "Kwai-Kolors/Kolors",
                        prompt: "{{Input.user_input}}",
                        imageSize: "1024x1024",
                        cfg: 7.5,
                        numInferenceSteps: 25,
                    },
                },
                tips: ["输出变量: {{ImageGen.imageUrl}}", "Kolors 适合唯美风格, Qwen 适合真实风格"],
            },
        };

        return schemas[nodeType] || { error: "Unknown node type" };
    },
});

// ============ Documentation Corpus (Static) ============
export const DOCUMENTATION_CORPUS = [
    // Input Node Documentation
    {
        keywords: ["input", "输入", "用户输入", "表单", "文件上传"],
        title: "Input 节点配置",
        content: `## Input 节点
- label (必填): 节点显示名称
- greeting: 欢迎语，显示在输入框上方
- enableTextInput (默认 true): 启用文本输入
- enableFileInput: 启用文件上传，需配合 fileConfig
- enableStructuredForm: 启用表单模式，需配合 formFields

### 文件上传配置
\`\`\`json
{
  "enableFileInput": true,
  "fileConfig": {
    "allowedTypes": [".pdf", ".docx", ".txt"],
    "maxSizeMB": 10,
    "maxCount": 5
  }
}
\`\`\`

### 输出变量
- {{Label.user_input}}: 用户文本输入
- {{Label.files}}: 上传的文件列表
- {{Label.formData.字段名}}: 表单字段值`,
    },
    // LLM Node Documentation
    {
        keywords: ["llm", "大模型", "AI", "gpt", "deepseek", "temperature", "systemPrompt", "记忆", "memory"],
        title: "LLM 节点配置",
        content: `## LLM 节点
- label (必填): 节点名称，用于变量引用
- model (必填): 模型名称，如 "deepseek-chat", "qwen-turbo"
- systemPrompt (必填): 系统提示词
- temperature (0.0-1.0): 创意程度，默认 0.7
- responseFormat: "text" 或 "json_object"
- enableMemory: 启用对话记忆
- memoryMaxTurns: 记忆轮数上限
- inputMappings.user_input: 用户输入来源

### 常用模型
| 模型 | 特点 |
|------|------|
| deepseek-chat | 通用对话，性价比高 |
| deepseek-reasoner | 推理增强，适合复杂逻辑 |
| qwen-turbo | 快速响应 |

### 输出变量
- {{Label.response}}: 模型回复文本
- {{Label.response.字段名}}: JSON 模式下的字段`,
    },
    // Output Node Documentation
    {
        keywords: ["output", "输出", "结果", "显示", "template", "merge", "附件"],
        title: "Output 节点配置",
        content: `## Output 节点
- label (必填): 节点名称
- inputMappings (必填): 输出映射配置

### 四种模式
1. **direct**: 直接输出单个变量
\`\`\`json
{ "mode": "direct", "sources": [{ "type": "variable", "value": "{{LLM.response}}" }] }
\`\`\`

2. **select**: 选择显示多个变量中的一个
3. **merge**: 合并多个变量
4. **template**: 模板拼接
\`\`\`json
{ "mode": "template", "template": "翻译结果：{{LLM.response}}" }
\`\`\`

### 图片附件
\`\`\`json
{
  "mode": "direct",
  "sources": [{ "type": "variable", "value": "{{LLM.response}}" }],
  "attachments": [{ "type": "variable", "value": "{{ImageGen.imageUrl}}" }]
}
\`\`\``,
    },
    // Branch Node Documentation
    {
        keywords: ["branch", "分支", "条件", "判断", "if", "else"],
        title: "Branch 节点配置",
        content: `## Branch 节点
- label (必填): 节点名称
- condition (必填): 条件表达式

### 条件语法
- 比较: \`{{LLM.response.score}} > 60\`
- 包含: \`{{LLM.response}}.includes('成功')\`
- 相等: \`{{LLM.response.status}} === 'pass'\`
- 逻辑: \`{{LLM.score}} > 60 && {{LLM.status}} === 'ok'\`

### 连接规则
- sourceHandle: "true" 连接条件为真的分支
- sourceHandle: "false" 连接条件为假的分支`,
    },
    // Tool Node Documentation
    {
        keywords: ["tool", "工具", "搜索", "网页", "计算", "代码"],
        title: "Tool 节点配置",
        content: `## Tool 节点
- label (必填): 节点名称
- toolType (必填): 工具类型
- inputs: 工具输入参数

### 工具类型
| toolType | 用途 | inputs |
|----------|------|--------|
| web_search | 联网搜索 | query, maxResults |
| url_reader | 网页读取 | url |
| calculator | 数学计算 | expression |
| datetime | 日期时间 | format |
| code_interpreter | 代码执行 | code, language |

### 输出变量
- web_search: {{Label.results}}, {{Label.count}}
- url_reader: {{Label.content}}
- calculator: {{Label.result}}`,
    },
    // RAG Node Documentation
    {
        keywords: ["rag", "知识库", "检索", "文档", "向量"],
        title: "RAG 节点配置",
        content: `## RAG 节点
- label (必填): 节点名称
- fileMode: "variable" (动态文件) 或 "static" (预设文件)
- inputMappings.query: 查询内容
- inputMappings.files: 文件来源 (fileMode=variable 时)

### 动态文件模式
\`\`\`json
{
  "fileMode": "variable",
  "inputMappings": {
    "query": "{{Input.user_input}}",
    "files": "{{Input.files}}"
  }
}
\`\`\`

### 输出变量
- {{Label.documents}}: 检索到的相关文档片段`,
    },
    // ImageGen Node Documentation
    {
        keywords: ["imagegen", "图片生成", "图像", "kolors", "绘图"],
        title: "ImageGen 节点配置",
        content: `## ImageGen 节点
- label (必填): 节点名称
- model (必填): 图片生成模型
- prompt: 图片描述提示词
- negativePrompt: 负面提示
- imageSize: 图片尺寸，如 "1024x1024"
- cfg: 提示词遵循度 (7.0-12.0)
- numInferenceSteps: 生成步数 (20-50)

### 模型选择
| 模型 | 风格 |
|------|------|
| Kwai-Kolors/Kolors | 唯美、插画 |
| Qwen/Qwen-Image | 真实、写实 |

### 输出变量
- {{Label.imageUrl}}: 生成的图片 URL`,
    },
    // Variable Reference Documentation
    {
        keywords: ["变量", "引用", "{{", "}}", "template"],
        title: "变量引用规则",
        content: `## 变量引用语法
格式: \`{{NodeLabel.outputField}}\`

### 常用变量
| 节点类型 | 变量 |
|----------|------|
| Input | {{Label.user_input}}, {{Label.files}} |
| LLM | {{Label.response}}, {{Label.response.field}} |
| RAG | {{Label.documents}} |
| Tool | {{Label.results}}, {{Label.result}} |
| ImageGen | {{Label.imageUrl}} |

### JSON 输出引用
当 LLM 使用 responseFormat: "json_object" 时:
- 直接引用字段: {{LLM.response.summary}}
- 嵌套引用: {{LLM.response.data.title}}`,
    },
];

// Helper to get base URL for server-side API calls
function getBaseUrl(): string {
    // Vercel deployment
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    // Local development
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

// ============ Search Documentation Tool (Vector Search) ============
export const searchDocumentationTool = tool({
    description: `Search Flash Flow documentation for node configuration details, parameter requirements, or best practices. Use this when:
- You're unsure about specific node configurations
- You need to understand parameter options
- You want to confirm correct syntax for variables or conditions`,
    inputSchema: z.object({
        query: z.string().describe("Search query about nodes, parameters, or workflow design"),
        topK: z.number().optional().describe("Number of results to return (default: 3)"),
        category: z.string().optional().describe("Filter by category (e.g., 'node', 'best_practice', 'variable')"),
    }),
    execute: async ({ query, topK = 3, category }) => {
        try {
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/api/agent/search-docs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, topK, category }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                console.error("Vector search failed:", data.error);
                return keywordSearchFallback(query);
            }

            if (data.results.length === 0) {
                return {
                    found: false,
                    message: "No relevant documentation found. Please use get_node_schema tool for specific node types.",
                };
            }

            return {
                found: true,
                results: data.results.map((r: any) => ({
                    title: r.title,
                    content: r.content,
                    score: r.similarity
                })),
            };
        } catch (error) {
            console.error("Search error:", error);
            return keywordSearchFallback(query);
        }
    },
});

// Fallback: Keyword matching for when vector search fails
function keywordSearchFallback(query: string) {
    const queryLower = query.toLowerCase();
    const matches: Array<{ title: string; content: string; score: number }> = [];

    for (const doc of DOCUMENTATION_CORPUS) {
        let score = 0;
        for (const keyword of doc.keywords) {
            if (queryLower.includes(keyword.toLowerCase())) {
                score += 2;
            }
            const queryWords = queryLower.split(/\s+/);
            for (const word of queryWords) {
                if (keyword.toLowerCase().includes(word) && word.length > 2) {
                    score += 1;
                }
            }
        }
        if (score > 0) {
            matches.push({ title: doc.title, content: doc.content, score });
        }
    }

    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 3);

    if (topMatches.length === 0) {
        return {
            found: false,
            message: "No relevant documentation found. Please use get_node_schema tool for specific node types.",
        };
    }

    return {
        found: true,
        results: topMatches.map(m => ({
            title: m.title,
            content: m.content,
        })),
    };
}

// ============ Phase 3: Intent Analyzer Tool ============
export const analyzeIntentTool = tool({
    description: `分析用户意图，返回结构化的意图分类、复杂度评估和节点建议。在生成工作流之前调用此工具理解用户需求。`,
    inputSchema: z.object({
        userPrompt: z.string().describe("用户的原始需求描述"),
    }),
    execute: async ({ userPrompt }) => {
        const scenario = detectIntentFromPrompt(userPrompt);
        const practice = BEST_PRACTICES[scenario];

        // 评估复杂度
        let complexity: "simple" | "medium" | "complex" = "simple";
        const promptLength = userPrompt.length;
        const hasMultipleKeywords = Object.values(INTENT_KEYWORDS)
            .flat()
            .filter(kw => userPrompt.toLowerCase().includes(kw.toLowerCase()))
            .length > 2;

        if (promptLength > 100 || hasMultipleKeywords) {
            complexity = "medium";
        }
        if (promptLength > 200 || userPrompt.includes("多步") || userPrompt.includes("复杂")) {
            complexity = "complex";
        }

        return {
            category: scenario,
            complexity,
            suggestedNodes: practice?.recommendedNodes || ["input", "llm", "output"],
            tips: practice?.tips || [],
            potentialImprovements: getProactiveSuggestions(scenario),
        };
    },
});

// ============ Phase 3: Best Practices Tool ============
export const getBestPracticesTool = tool({
    description: `获取特定场景的最佳实践建议。包括推荐配置、常见错误和优化建议。`,
    inputSchema: z.object({
        scenario: z.enum(["翻译", "内容生成", "图片生成", "知识问答", "条件判断", "数据处理", "综合"])
            .describe("工作流的场景类型"),
    }),
    execute: async ({ scenario }) => {
        const practice = BEST_PRACTICES[scenario as ScenarioType];

        if (!practice) {
            return {
                found: false,
                message: `未找到场景 "${scenario}" 的最佳实践`,
            };
        }

        return {
            found: true,
            scenario,
            description: practice.description,
            tips: practice.tips,
            recommendedNodes: practice.recommendedNodes,
            commonMistakes: practice.commonMistakes,
            suggestedImprovements: practice.suggestedImprovements,
        };
    },
});

// ============ Phase 3: Suggest Improvements Tool ============
export const suggestImprovementsTool = tool({
    description: `基于已生成的工作流，分析并提出优化建议。在验证通过后可选调用。`,
    inputSchema: z.object({
        workflow: z.object({
            nodes: z.array(z.any()),
            edges: z.array(z.any()),
        }).describe("当前的工作流 JSON"),
    }),
    execute: async ({ workflow }) => {
        const suggestions: Array<{ type: string; reason: string; recommendation?: string }> = [];
        const nodes = workflow.nodes as Array<{ type: string; data?: Record<string, unknown> }>;

        // 分析节点类型分布
        const nodeTypes = nodes.map(n => n.type);
        const hasInput = nodeTypes.includes("input");
        const hasOutput = nodeTypes.includes("output");
        const hasLLM = nodeTypes.includes("llm");
        const hasBranch = nodeTypes.includes("branch");
        const hasImageGen = nodeTypes.includes("imagegen");
        const hasRAG = nodeTypes.includes("rag");

        // 规则 1: 检查是否缺少 Input/Output
        if (!hasInput) {
            suggestions.push({
                type: "add",
                reason: "工作流缺少 Input 节点",
                recommendation: "添加 Input 节点作为入口"
            });
        }
        if (!hasOutput) {
            suggestions.push({
                type: "add",
                reason: "工作流缺少 Output 节点",
                recommendation: "添加 Output 节点作为出口"
            });
        }

        // 规则 2: 复杂流程建议添加错误处理
        if (nodes.length > 4 && !hasBranch) {
            suggestions.push({
                type: "enhance",
                reason: "复杂工作流建议添加条件分支",
                recommendation: "考虑添加 Branch 节点处理边界情况"
            });
        }

        // 规则 3: 图片生成检查
        if (hasImageGen) {
            const imageGenNode = nodes.find(n => n.type === "imagegen");
            const data = imageGenNode?.data;
            if (data && !data.negativePrompt) {
                suggestions.push({
                    type: "optimize",
                    reason: "图片生成节点缺少负面提示词",
                    recommendation: "添加 negativePrompt 以提高生成质量"
                });
            }
        }

        // 规则 4: LLM temperature 检查
        for (const node of nodes) {
            if (node.type === "llm" && node.data) {
                const temp = node.data.temperature as number | undefined;
                if (temp !== undefined && temp > 0.8) {
                    suggestions.push({
                        type: "optimize",
                        reason: `LLM 节点 temperature=${temp} 过高`,
                        recommendation: "建议降低 temperature 以提高输出稳定性"
                    });
                }
            }
        }

        // 规则 5: RAG 检查
        if (hasRAG) {
            const ragNode = nodes.find(n => n.type === "rag");
            const data = ragNode?.data;
            if (data && !data.inputMappings) {
                suggestions.push({
                    type: "fix",
                    reason: "RAG 节点缺少 inputMappings 配置",
                    recommendation: "配置 inputMappings.query 和 inputMappings.files"
                });
            }
        }

        return {
            analyzed: true,
            nodeCount: nodes.length,
            suggestionCount: suggestions.length,
            suggestions,
            overallQuality: suggestions.length === 0 ? "excellent" :
                suggestions.length <= 2 ? "good" : "needs_improvement"
        };
    },
});

// Export all tools as a collection
export const agentTools = {
    validate_flow: validateFlowTool,
    get_node_schema: getNodeSchemaTool,
    search_documentation: searchDocumentationTool,
    // Phase 3: Domain Expert Tools
    analyze_intent: analyzeIntentTool,
    get_best_practices: getBestPracticesTool,
    suggest_improvements: suggestImprovementsTool,
};
