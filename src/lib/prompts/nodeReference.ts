export const NODE_REFERENCE = `
# 📦 节点类型参考手册 (Node Reference)

> 🔴 建议将节点配置放在 JSON 的 "data" 字段中；如未使用 data 包裹，也可将字段直接挂在节点对象上（系统会兼容解析）。配置内容需符合本手册接口定义。

---

## 1. Input 节点 (用户入口)
### 1.1 参数定义
\`\`\`typescript
interface InputNodeData {
  label: string;                  // 必填，节点显示名称
  greeting?: string;              // 欢迎语
  enableTextInput?: boolean;      // 默认: true
  textRequired?: boolean;         // 默认: false（仅 enableTextInput=true 时生效）
  enableFileInput?: boolean;      // 默认: false
  fileRequired?: boolean;         // 默认: false（仅 enableFileInput=true 时生效）
  enableStructuredForm?: boolean; // 默认: false
  fileConfig?: {
    allowedTypes: string[];       // 推荐: [".pdf", ".doc", ".docx", ".png", ".jpg"]
    maxSizeMB: number;            // 1-100
    maxCount: number;             // 1-10
  };
  formFields?: FormFieldConfig[];
}

type FormFieldConfig = 
  | { type: "select"; name: string; label: string; options: string[]; required: boolean }
  | { type: "text"; name: string; label: string; placeholder?: string; required: boolean };
  
// 🔴 约束: name 必须为纯英文变量名 (详见 Variable Rules)。
\`\`\`

### 1.2 生成与校验规则 (必须遵守)
1. 各输入方式开关完全独立：
   - \`enableTextInput\` 和 \`enableFileInput\` 可以分别独立开启/关闭
   - \`textRequired\` 仅在 \`enableTextInput: true\` 时生效
   - \`fileRequired\` 仅在 \`enableFileInput: true\` 时生效
2. 当 \`enableFileInput: true\` 时，\`fileConfig\` 必须存在且合法（allowedTypes/maxSizeMB/maxCount）。

---

## 2. LLM 节点 (大语言模型)
### 2.1 参数定义
\`\`\`typescript
interface LLMNodeData {
  label: string;
  model: string;                  // 推荐: "deepseek-chat", "qwen-flash"
  systemPrompt: string;           // 支持 {{变量}} 引用
  temperature: number;            // 0.0-1.0
  enableMemory?: boolean;         // 默认: false
  
  // 🟢 JSON 模式开关 (CRITICAL)
  // 当 System Prompt 要求输出 JSON，或下游节点需要通过 {{节点.response.字段}} 访问特定属性时，
  // 必须显式设置 responseFormat: "json_object"。
  responseFormat?: "text" | "json_object"; 
  
  // 🔴 严格模式: 必须显式配置 user_input 的变量来源，否则 LLM 将收到空输入。
  inputMappings: {
    user_input: string;           // 如 "{{输入.user_input}}" 或 "{{input_xxx.user_input}}"
  };
}
// 🔴 约束: 目前仅支持文本输入。严禁直接传入文件列表或图片 URL。
\`\`\`

---

## 3. RAG 节点 (知识库检索)
### 3.1 参数定义
\`\`\`typescript
interface RAGNodeData {
  label: string;
  fileMode: "variable" | "static";
  fileSearchStoreName?: string;   // fileMode="static" 时必填
  inputMappings: {
    query: string;                // 如 "{{Input.user_input}}"
    files?: string;               // fileMode="variable" 时使用，如 "{{Input.files}}"
    files2?: string;
    files3?: string;
  };
  maxTokensPerChunk?: number;     // 默认 200
}
\`\`\`

---

## 4. Tool 节点 (工具调用)
### 4.1 参数定义
\`\`\`typescript
interface ToolNodeData {
  label: string;
  toolType: "web_search" | "url_reader" | "calculator" | "datetime" | "code_interpreter";
  inputs: Record<string, any>;
}
\`\`\`
- **web_search**: \`{ query: string, maxResults?: number }\`（1-10，默认 5）
- **url_reader**: \`{ url: string, maxLength?: number }\`（默认 5000）
- **calculator**: \`{ expression: string }\`
- **datetime**: \`{ operation: "now" | "format" | "diff" | "add", ... }\`
  - now: \`{ operation: "now", format?: string }\`
  - format: \`{ operation: "format", date: string, format: string }\`
  - diff: \`{ operation: "diff", date?: string, targetDate: string, unit?: "year"|"month"|"day"|"hour"|"minute"|"second" }\`
  - add: \`{ operation: "add", date?: string, amount: number, unit: "year"|"month"|"day"|"hour"|"minute"|"second", format?: string }\`
- **code_interpreter**: \`{ code: string, inputFiles?: Array<{name: string, url: string}>, outputFileName?: string }\`

---

## 5. Branch 节点 (逻辑分支)
### 5.1 参数定义
\`\`\`typescript
interface BranchNodeData {
  label: string;
  condition: string;  // 受限条件表达式（白名单语法），如 "{{LLM.response}}.includes('YES')"
}
\`\`\`

### 5.2 条件表达式语法（必须遵守）
仅支持以下白名单表达式，并可用 \`&&\` / \`||\` 进行组合：
1. 包含/前后缀（字符串）
   - \`{{Node.field}}.includes('关键词')\`
   - \`{{Node.field}}.startsWith('前缀')\`
   - \`{{Node.field}}.endsWith('后缀')\`
2. 严格相等/不等
   - \`{{Node.field}} === 'value'\`
   - \`{{Node.field}} !== 'value'\`
3. 数值比较
   - \`{{Node.field}} > 10\`, \`>=\`, \`<\`, \`<=\`
4. 常量比较（无需引用节点）
   - \`true\`, \`false\`
   - \`1 > 0\`, \`'a' === 'a'\`

禁止：
- 使用 \`==\`、\`!=\`
- 使用括号、\`!\`、三元表达式、正则、任意函数调用（除 includes/startsWith/endsWith）
- 在 \`{{ }}\` 内写逻辑或运算（详见 Variable Rules）

---

## 6. ImageGen 节点 (AI 绘图)
### 6.1 参数定义
\`\`\`typescript
interface ImageGenNodeData {
  label: string;
  model: string;            // "Kwai-Kolors/Kolors", "Qwen/Qwen-Image"
  prompt: string;           // 建议为英文
  imageSize?: string;       // 如 "1024x1024"
  referenceImageVariable?: string; // 如 "{{Input.files[0].url}}"
}
\`\`\`

---

## 7. Output 节点 (最终响应)
### 7.1 参数定义
\`\`\`typescript
interface OutputNodeData {
  label: string;
  inputMappings: {
    mode: "direct" | "select" | "merge" | "template";
    sources?: Array<{ type: "variable" | "static", value: string }>;
    template?: string;      // mode="template" 时必填
    attachments?: Array<{ type: "variable" | "static", value: string }>;
  };
}
// 🔴 约束: Template 模式严禁包含逻辑标签 (详见 Variable Rules)。
\`\`\`
`;
