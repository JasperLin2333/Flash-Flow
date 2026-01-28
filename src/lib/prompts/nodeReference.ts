export const NODE_REFERENCE = `
# 📦 节点类型参考手册

> 🔴 生成的 JSON "data" 字段必须严格符合本手册的接口定义。禁止幻觉。

---

## 1. Input 节点 (用户入口)

### 1.1 参数定义
\`\`\`typescript
interface InputNodeData {
  label: string;                  // 必填，节点显示名称
  greeting?: string;              // 欢迎语，引导用户操作
  
  // 输入模式开关
  enableTextInput?: boolean;      // 默认: true，启用文本输入
  enableFileInput?: boolean;      // 默认: false。⚠️ 必须配合 fileConfig
  enableStructuredForm?: boolean; // 默认: false。⚠️ 必须配合 formFields
  
  fileConfig?: {
    allowedTypes: string[];       // 可选值见下方推荐
    maxSizeMB: number;            // 范围 1-100
    maxCount: number;             // 范围 1-10
  };
  
  formFields?: FormFieldConfig[];
}

// 表单字段类型
type FormFieldConfig = 
  | { type: "select"; name: string; label: string; options: string[]; required: boolean; defaultValue?: string }
  | { type: "text"; name: string; label: string; placeholder?: string; required: boolean; defaultValue?: string }
  | { type: "multi-select"; name: string; label: string; options: string[]; required: boolean; defaultValue?: string[] };
  
  // 🔴 关键约束:
  // 1. name: 必须是纯英文变量名 (camelCase/snake_case)，禁止中文/括号/空格。如 "topic", "art_style"
  // 2. label: 面向用户的展示名称，可以是中文。如 "文章主题", "艺术风格"
\`\`\`

### 1.2 输出变量 (供下游引用)
| 变量 | 类型 | 说明 |
|------|------|------|
| \`user_input\` | string | 用户输入的文本内容 |
| \`files\` | Array<{name, url, type, size}> | 上传的文件列表 |
| \`files[0].url\` | string | 第一个文件的 URL |
| \`formData.字段名\` | string | 结构化表单字段值 |

### 1.3 参数可选值
**fileConfig.allowedTypes 推荐**:
| 场景 | 推荐值 |
|------|--------|
| 文档 | \`[".pdf", ".doc", ".docx", ".txt", ".md"]\` |
| 图片 | \`[".png", ".jpg", ".jpeg", ".webp"]\` |
| 数据 | \`[".csv", ".xls", ".xlsx", ".json"]\` |

---

## 2. LLM 节点 (大语言模型)

### 2.1 参数定义
\`\`\`typescript
interface LLMNodeData {
  label: string;
  model: string;                  // 必填
  systemPrompt: string;           // 必填，支持 {{节点名.变量名}} 引用
  temperature: number;            // 0.0-1.0，默认 0.7
  
  // 🔴 关键约束: 仅支持纯文本输入。
  // 严禁传入图片 URL、文件列表或二进制数据。
  // 必须通过 RAG 节点将文档转为文本后再传入。
  
  enableMemory?: boolean;         // 默认: false
  memoryMaxTurns?: number;        // 默认: 10，范围 1-20
  
  responseFormat?: "text" | "json_object"; // 默认: "text"
  
  inputMappings?: {
    user_input?: string;          // 如 "{{用户输入.user_input}}"
  };
  // 🔴 inputMappings 的 Key 必须是纯英文，禁止中文。
  // ✅ inputMappings: { "context": "...", "topic": "..." }
  // ❌ inputMappings: { "用户输入": "..." }
}
\`\`\`

### 2.2 输出变量
| 变量 | 类型 | 说明 |
|------|------|------|
| \`response\` | string \\| object | LLM 生成的内容。当 responseFormat="json_object" 时为 JSON 对象 |
| \`response.字段名\` | any | JSON 模式下可直接访问字段，如 \`{{翻译节点.response.title}}\`, \`{{翻译节点.response.items[0]}}\` |

### 2.3 参数可选值
**model 推荐选择策略**:
| 分类 | 推荐模型 ID | 适用场景 |
|------|------------|----------|
| **🚀 推理/复杂任务** (首选) | \`"deepseek-chat"\` <br> \`"deepseek-ai/DeepSeek-V3.2"\` <br> \`"deepseek-v3-2-251201"\` (火山引擎) | 逻辑分析、代码编写、复杂指令、JSON 格式化 |
| **⚡ 快速/高性价比** | \`"qwen-flash"\` <br> \`"doubao-seed-1-6-flash-250828"\` <br> \`"mimo-v2-flash"\` | 简单问答、翻译、分类、小红书文案 |
| **⚖️ 均衡/通用** | \`"gemini-3-pro-preview"\` <br> \`"doubao-1-5-pro-32k-character-250715"\` <br> \`"doubao-seed-1-6-251015"\` <br> \`"THUDM/GLM-Z1-9B-0414"\` | 常规对话、文本生成、长文本总结 (需配合 RAG) |
| **🧪 实验/其他** | \`"deepseek-ai/DeepSeek-R1-0528-Qwen3-8B"\` | 需要尝试新模型特性的不管是啥 |

> ⚠️ **关键约束**:
> 1. **仅支持文本**: 目前系统所有 LLM 节点仅支持文本输入，**不支持**直接发送图片、视频或原始文件。
> 2. **文件处理**: 所有文档（PDF/Word/TXT等）**必须**先经过 **RAG 节点** 进行检索，再将 \`{{RAG.documents}}\` 传入 LLM 节点。
> 3. **默认选择**: 除非用户明确指定，否则默认优先使用 \`deepseek-chat\` (性能最均衡) 或 \`qwen-flash\` (速度最快)。

**temperature 推荐**:
| 范围 | 适用场景 |
|------|----------|
| 0.0-0.3 | 翻译、代码、数据提取 |
| 0.3-0.7 | 问答、总结、客服 |
| 0.7-1.0 | 创意写作、头脑风暴 |

### 2.4 设计指南
> 🔴 **输入隔离原则**
> - System Prompt: 静态人设 + 动态上下文 (\`{{RAG节点.documents}}\`)
> - User Input: 当前指令 (\`{{用户输入.user_input}}\`)

> 🟢 **JSON 模式协议 (关键)**
> 当下游节点需要引用 LLM 输出的**特定字段**时 (如用于 Branch 判断或 Code Interpreter 参数):
> 1. **必须开启**: 设置 \`responseFormat: "json_object"\`.
> 2. **Prompt 约束**: System Prompt 必须包含 "Output JSON" 并定义 Schema，例如: \`{"key": "value"}\`.
> 3. **精准引用**: 下游**必须**使用 \`{{节点.response.字段名}}\`。
>    - ❌ \`{{翻译节点.response}}\` -> \`"{ \\"status\\": \\"ok\\" }"\` (字符串)
>    - ✅ \`{{翻译节点.response.status}}\` -> \`"ok"\` (值)
>    - ✅ \`{{翻译节点.response.items[0]}}\` -> (数组首项)

---

## 3. RAG 节点 (知识库检索)

### 3.1 参数定义
\`\`\`typescript
interface RAGNodeData {
  label: string;
  fileMode?: "variable" | "static";  // 默认: "static"
  
  // 动态模式 (fileMode="variable")
  inputMappings?: {
    query?: string;     // 必填，如 "{{用户输入.user_input}}"
    files?: string;     // 必填 (主槽位)，如 "{{用户输入.files}}"
    files2?: string;    // 可选 (槽位2)
    files3?: string;    // 可选 (槽位3)
  };
  
  maxTokensPerChunk?: number;  // 默认: 200
  maxOverlapTokens?: number;   // 默认: 20
}
\`\`\`

### 3.2 输出变量
| 变量 | 类型 | 说明 |
|------|------|------|
| \`documents\` | string | 检索到的相关文档内容，已拼接为文本 |
| \`query\` | string | 实际使用的检索查询 |

### 3.3 参数可选值
**fileMode**:
| 值 | 使用场景 |
|----|----------|
| \`"variable"\` | 处理用户上传的文件 |
| \`"static"\` | 预置知识库（UI 配置） |

---

## 4. Tool 节点 (工具调用)

### 4.1 参数定义
\`\`\`typescript
interface ToolNodeData {
  label: string;
  toolType: "web_search" | "url_reader" | "calculator" | "datetime" | "code_interpreter";
  inputs: ToolInputs;
}
\`\`\`

### 4.2 各工具 inputs 与输出变量

**web_search**:
\`\`\`typescript
inputs: { query: string; maxResults?: number; }  // maxResults 默认 5
\`\`\`
| 输出变量 | 类型 | 说明 |
|----------|------|------|
| \`results\` | Array<{title, url, snippet}> | 搜索结果列表 |
| \`count\` | number | 结果数量 |

**url_reader**:
\`\`\`typescript
inputs: { url: string; maxLength?: number; }
\`\`\`
| 输出变量 | 类型 | 说明 |
|----------|------|------|
| \`content\` | string | 网页正文内容 |
| \`title\` | string | 网页标题 |

**calculator**:
\`\`\`typescript
inputs: { expression: string; }  // 如 "(1+2)*3"
\`\`\`
| 输出变量 | 类型 | 说明 |
|----------|------|------|
| \`result\` | number | 计算结果 |

**datetime**:
\`\`\`typescript
inputs: 
  | { operation: "now"; format?: string; }
  | { operation: "format"; date: string; format: string; }
  | { operation: "diff"; date: string; targetDate: string; unit?: string; }
  | { operation: "add"; date: string; amount: number; unit: string; }
\`\`\`
| 输出变量 | 类型 | 说明 |
|----------|------|------|
| \`formatted\` | string | 格式化后的时间字符串 |
| \`timestamp\` | number | Unix 时间戳 |

**code_interpreter**:
\`\`\`typescript
inputs: { code: string; outputFileName?: string; inputFiles?: Array<{name, url}>; }
\`\`\`
| 输出变量 | 类型 | 说明 |
|----------|------|------|
| \`result\` | any | 代码执行返回值 |
| \`logs\` | string | 执行日志 (print 输出) |
| \`generatedFile\` | {name, url} | 生成的文件信息 |

---

## 5. Branch 节点 (逻辑分支)

### 5.1 参数定义
\`\`\`typescript
interface BranchNodeData {
  label: string;
  condition: string;  // 条件表达式
}
\`\`\`

### 5.2 输出变量
| 变量 | 类型 | 说明 |
|------|------|------|
| \`conditionResult\` | boolean | 条件判断结果 |

### 5.3 condition 语法
| 类型 | 操作符 |
|------|--------|
| 比较 | \`>\`, \`<\`, \`>=\`, \`<=\`, \`===\`, \`!==\` |
| 字符串 | \`.includes()\`, \`.startsWith()\`, \`.endsWith()\` |
| 逻辑 | \`&&\`, \`||\` |

**示例**: \`{{翻译节点.response}}.includes("成功")\`

---

## 6. ImageGen 节点 (AI 绘图)

### 6.1 参数定义
\`\`\`typescript
interface ImageGenNodeData {
  label: string;
  model: string;
  prompt: string;           // 必填，支持 {{变量}}
  negativePrompt?: string;
  imageSize?: string;       // 默认 "1024x1024"
  cfg?: number;             // 默认 7.0 (建议显式设置)
  numInferenceSteps?: number; // (建议显式设置)
  
  referenceImageMode?: "variable" | "static";
  referenceImageVariable?: string;  // 如 "{{用户输入.files[0].url}}"
}
\`\`\`

### 6.2 输出变量
| 变量 | 类型 | 说明 |
|------|------|------|
| \`imageUrl\` | string | 生成图片的 URL，用于 Output 附件 |

### 6.3 参数可选值
**model**:
| 模型 ID | 说明 | 推荐 CFG | 推荐 Steps |
|---------|------|---------|------------|
| \`"Kwai-Kolors/Kolors"\` | 可灵 (唯美艺术) | 7.5 | 25 |
| \`"Qwen/Qwen-Image"\` | 千问-文生图 (真实摄影) | 4.0 | 28 |
| \`"Qwen/Qwen-Image-Edit-2509"\` | 千问-图生图 (需要参考图) | 4.0 | 50 |

**imageSize (仅 Kolors 和 Qwen-Image 支持)**:
- **Kolors**:
  - \`"1024x1024"\` (1:1), \`"960x1280"\` (3:4), \`"768x1024"\` (3:4), \`"720x1440"\` (1:2), \`"720x1280"\` (9:16)
- **Qwen-Image**:
  - \`"1328x1328"\` (1:1)
  - \`"1664x928"\` (16:9), \`"928x1664"\` (9:16)
  - \`"1472x1140"\` (4:3), \`"1140x1472"\` (3:4)
  - \`"1584x1056"\` (3:2), \`"1056x1584"\` (2:3)
> Note: \`Qwen-Image-Edit\` handles sizes automatically.

---

## 7. Output 节点 (最终响应)

### 7.1 参数定义
\`\`\`typescript
interface OutputNodeData {
  label: string;
  inputMappings: {
    mode: "direct" | "select" | "merge" | "template";
    
    sources?: Array<{
      type: "variable" | "static";
      value: string;           // 如 "{{翻译节点.response}}"
    }>;
    
    template?: string;         // mode="template" 时必填
    
    attachments?: Array<{
      type: "variable" | "static";
      value: string;           // 如 "{{绘图节点.imageUrl}}"
    }>;
  };
}
\`\`\`

### 7.2 mode 可选值
| 值 | 说明 | 使用场景 |
|----|------|----------|
| \`"direct"\` | **首选**，直接流式输出 | 单一 LLM 输出 |
| \`"select"\` | 选择第一个非空 | 分支汇聚 |
| \`"template"\` | 模板合并 | 需要合并多个来源 |

### 7.3 注意事项
> 🔴 **Template 模式严禁逻辑**:
> - 仅支持简单的 **变量替换** (如 \`{{Node.var}}\`)。
> - **严禁**使用 \`{{#each}}\`, \`{{#if}}\` 等模板逻辑。
> - 如需循环/判断，请在 **LLM 节点** 内部处理好，直接输出完整文本。
`;
