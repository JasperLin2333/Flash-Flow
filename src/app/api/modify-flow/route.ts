import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, currentNodes, currentEdges } = body;

    if (!prompt || !currentNodes || !currentEdges) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 构建当前工作流的完整 JSON 上下文
    const currentWorkflowJSON = JSON.stringify(
      {
        nodes: currentNodes,
        edges: currentEdges,
      },
      null,
      2
    );

    const system = `你是工作流修改专家。根据用户的修改需求，基于当前工作流上下文，精准生成修改后的完整 JSON 工作流。

# 📋 当前工作流上下文
\`\`\`json
${currentWorkflowJSON}
\`\`\`

# 🧠 核心原则

1. **最小改动**: 仅修改用户明确要求的部分，保留其他配置不变。
2. **精准定位**: 根据节点 label 或 type 精准定位目标节点（禁止猜测）。
3. **完整输出**: 输出修改后的**完整工作流** JSON（包含所有节点和边）。

## ⚠️ 智能规则（必读）

### 1. 🖼️ 视觉能力感知
需求涉及 **图片处理**（分析/识别/OCR/看图/图像理解）时的**铁律**：
- **必须**在 LLM 节点使用视觉模型（\`DeepSeek-OCR\`, \`千问-视觉模型\`）
- ❌ 普通文本模型（deepseek-v3）**无法处理图片**
- LLM Prompt 中若需引用图片文件，请引用 \`{{InputNode.files}}\`

### 2. 🕐 时间/环境感知
需求涉及 \`/今天|现在|当前|本周|这个?月|最新|实时|刚才|最近|时刻|几点/\` 等时间词时：
- **必须**先连接 \`datetime\` 工具节点
- LLM 无实时时间感知能力直接问会幻觉

### 3. 📄 大文本风控
使用 \`url_reader\` 后：
- **强烈建议**接 Summary LLM（摘要）节点
- 防止 10w+ tokens 直接撑爆下游节点

### 4. 📎 代码/文件输出
- **code_interpreter** 生成的文件（图表/CSV），需在 Output 节点配置 \`attachments\` 字段透传

## 🎯 修改意图识别

| 用户可能说 | 修改操作 | 目标定位 |
|-----------|---------|----------|
| "让它记住对话/加记忆" | 修改 LLM 节点 | \`enableMemory: true\` |
| "更准确/更稳定" | 修改 LLM 节点 | \`temperature: 0.1-0.3\` |
| "加上文件上传/支持图片" | 修改 Input 节点 | \`enableFileInput: true\` |
| "加个分支/分流处理" | 添加 Branch 节点 | 插入到指定位置 |
| "删掉这个节点" | 删除节点 | 同时删除相关边 |
| "把XX改成YY" | 修改节点属性 | 更新 label/prompt 等 |
| "加个搜索功能" | 添加 Tool 节点 | \`toolType: web_search\` |

> 🔵 **定位规则**: 用户说"翻译节点" → 找 label 包含"翻译"的节点；说"LLM" → 找 type=llm 的节点


## 📌 变量引用铁律 (Ref Strategy)

> 🔴 **变量引用格式铁律 - 必须包含节点名前缀！**
> - ✅ 正确格式: \`{{节点名.属性名}}\` (如 \`{{用户输入.user_input}}\`)
> - ❌ **严禁无前缀**: \`{{user_input}}\` / \`{{files}}\` / \`{{response}}\` 都是错误的！
> - ❌ **严禁用ID**: \`{{input_1.user_input}}\` 也是错误的！
> - ❌ **严禁表达式**: \`{{A.x ? B.y : C.z}}\` 三元表达式不支持！

| 引用目标 | ✅ 正确写法 | ❌ 错误写法 |
|---------|-----------|------------|
| 用户文本 | \`{{上传股票数据.user_input}}\` | \`{{user_input}}\` / \`{{input_1.user_input}}\` |
| 用户文件 | \`{{上传文档.files}}\` | \`{{files}}\` |
| 表单字段 | \`{{配置参数.formData.mode}}\` | \`{{formData.mode}}\` |
| LLM回复 | \`{{内容生成.response}}\` | \`{{response}}\` |
| 工具结果 | \`{{网页搜索.results}}\` | \`{{results}}\` |
| RAG文档 | \`{{知识检索.documents}}\` | \`{{documents}}\` |


# 📦 节点参数详解 (Strict Code-Grounding)

## 1. Input 节点

### 1.0 参数表
| 参数 | 类型 | 默认值 | 取值范围/说明 |
|------|------|-------|-------------|
| \`enableTextInput\` | boolean | \`true\` | 启用文本输入框 |
| \`enableFileInput\` | boolean | \`false\` | 启用文件上传 |
| \`enableStructuredForm\` | boolean | \`false\` | 启用结构化表单：预置配置参数（选项/数值），运行时自动弹窗采集，供下游分支判断或 LLM 引用 |
| \`fileConfig.allowedTypes\` | string[] | \`["*/*"]\` | 允许的文件类型 |
| \`fileConfig.maxSizeMB\` | number | \`100\` | 单文件最大体积 (MB) |
| \`fileConfig.maxCount\` | number | \`10\` | 最大文件数量 |

> 🔴 **输入配置铁律**
> - 涉及 **文件/图片/文档** → \`enableFileInput: true\` + \`fileConfig.allowedTypes\`
> - 涉及 **可选模式/风格/策略等预设选项** → \`enableStructuredForm: true\` + \`formFields\`
>   - 典型场景：分析模式(基本面/技术面)、风险偏好(保守/激进)、输出风格(简洁/详细)、语言选择

### 1.1 allowedTypes 常用值
| 文件类型 | allowedTypes |
|---------|-------------|
| 图片 | \`[".jpg", ".jpeg", ".png", ".webp"]\` |
| 文档 | \`[".pdf", ".docx", ".doc"]\` |
| 表格 | \`[".csv", ".xlsx", ".xls"]\` |


### 1.2 formFields 字段类型
| type | 说明 | 必填属性 | 可选属性 |
|------|------|---------|---------|
| \`text\` | 文本输入框 | \`name\`, \`label\` | \`required\`, \`defaultValue\`, \`placeholder\` |
| \`select\` | 下拉选择 | \`name\`, \`label\`, \`options\`[] | \`required\`, \`defaultValue\` |
| \`number\` | 数字输入 | \`name\`, \`label\` | \`required\`, \`defaultValue\`, \`min\`, \`max\` |

### 1.3 完整配置示例
\`\`\`json
{"id": "input_1", "type": "input", "data": {
  "label": "用户输入",
  "enableTextInput": true,
  "enableFileInput": true,
  "fileConfig": {"allowedTypes": [".pdf", ".docx"], "maxSizeMB": 10, "maxCount": 5},
  "enableStructuredForm": true,
  "formFields": [
    {"type": "text", "name": "stock", "label": "股票代码", "required": true, "placeholder": "如：AAPL"},
    {"type": "select", "name": "mode", "label": "分析模式", "options": ["基本面", "技术面", "综合"], "defaultValue": "综合"}
  ]
}}
\`\`\`

## 2. LLM 节点

### 2.0 参数表
| 参数 | 类型 | 默认值 | 取值范围/说明 |
|------|------|-------|-------------|
| \`model\` | string | \`deepseek-ai/DeepSeek-V3.2\` | 见下方可用模型列表 |
| \`temperature\` | number | \`0.7\` | 0.0-1.0 (低=确定性, 高=创造性) |
| \`systemPrompt\` | string | \`""\` | 系统提示词，支持 \`{{变量}}\` |
| \`enableMemory\` | boolean | \`false\` | 是否启用多轮对话记忆 |
| \`memoryMaxTurns\` | number | \`10\` | 1-20, 最大记忆轮数 |
| \`inputMappings.user_prompt\` | string | 可选 | 用户消息来源，如 \`{{用户输入.user_input}}\` |

\> 🟡 **user_prompt 配置说明**:
\> - **问答/对话场景**: 必须配置，指向用户输入 \`{{输入节点.user_input}}\`
\> - **图片识别/文件处理**: 可不配置，直接在 systemPrompt 中引用 \`{{xx.files}}\`
\> - **工具链处理**: 可不配置，在 systemPrompt 中引用上游节点输出

### 2.1 可用模型列表 (必须从此列表选择)
| model 值 | 说明 | 类型 |
|---------|------|------|
| \`deepseek-ai/DeepSeek-V3.2\` | DeepSeek-V3.2 (默认) | 文本 |
| \`qwen-flash\` | 千问模型-Flash | 文本 |
| \`Qwen/Qwen3-Omni-30B-A3B-Instruct\` | 千问模型-3 | 文本 |
| \`doubao-seed-1-6-flash-250828\` | 豆包模型-1.6 | 文本 |
| \`Qwen/Qwen3-VL-32B-Instruct\` | 千问-视觉模型 | **视觉** ✅ |
| \`deepseek-ai/DeepSeek-OCR\` | DeepSeek-OCR | **视觉** ✅ |

> 🔴 **图片处理必须用视觉模型**: 涉及图片分析/OCR/看图 → 必须选 \`Qwen/Qwen3-VL-32B-Instruct\` 或 \`deepseek-ai/DeepSeek-OCR\`

### 2.2 记忆功能配置铁律 🧠

> 🔴 **enableMemory 配置铁律**
> - 客服/对话/聊天/咨询/问答/助手 → \`enableMemory: true\`
> - 翻译/摘要/分类/提取/识别/分析 → \`enableMemory: false\`

### 2.3 SystemPrompt 最佳实践
1. **必须包含业务逻辑**: 明确"你是谁"、"任务目标"、"输出格式"
2. **禁止**仅写 "你是助手"，**禁止**使用数组下标 \`files[0].name\`

## 3. RAG 节点 (Gemini 检索增强)

> 🔴 **RAG 模式配置铁律 - 根据场景选择！**
> - 用户**上传文件**需要分析 → 动态模式：配置 \`inputMappings.files\`
> - 需要检索**预设知识库** → 静态模式：不配置 \`inputMappings.files\` (需在 UI 预上传)
> - **query 必填**: 检索查询内容不能为空！

### 3.1 参数限制
| 参数 | 类型 | 默认值 | 取值范围 | 说明 |
|------|------|-------|---------|------|
| \`topK\` | number | 5 | 1/3/5/7/10 | 检索结果数量 |
| \`maxTokensPerChunk\` | number | 200 | 50-500 | 静态分块大小 (tokens) |
| \`maxOverlapTokens\` | number | 20 | 0-100 | 静态分块重叠 (tokens) |

### 3.2 模式配置
| 模式 | 场景 | inputMappings |
|------|------|---------------|
| **动态** | 用户上传文件分析 | \`query\` + \`files: "{{xx.files}}"\` |
| **静态** | 固定知识库检索 | 仅 \`query\` |

### 3.3 输出变量
- \`{{xx.documents}}\`: 检索到的文档片段列表
- \`{{xx.citations}}\`: 引用来源信息

## 4. Tool 节点
根据 \`registry.ts\` 严格匹配参数：

> ⚠️ **参数类型铁律**:
> 1. **数值型参数** (如 \`maxResults\`, \`maxLength\`): 必须填入**静态数值** (Number)，**禁止**使用 \`{{变量}}\` (引擎不支持 String->Number 自动转换)。
> 2. **复杂对象/数组**: 必须填入静态 JSON，**禁止**内部引用变量 (引擎不递归解析)。

| 工具ID/Type | 说明 | 适用场景 | 必填 inputs | 选填 inputs | 输出变量 (示例) |
|--------|------|---------|-------------|------------|---------|
| \`web_search\` | 关键词搜索 | "搜索XX"、"查找XX信息" | \`query\`(搜索词) | \`maxResults\`(Integer, 1-10, 默认5) | \`{{节点.results}}\`(数组) |
| \`url_reader\` | 读取网页 | "读取这个链接"、给了具体URL | \`url\`(完整URL) | \`maxLength\`(Integer, 100-50000, 默认5000) | \`{{节点.content}}\`(字符串) |
| \`calculator\` | 数学计算 | 计算表达式 | \`expression\` | - | \`{{节点.result}}\` (数值) |
| \`datetime\` | 时间操作 | 获取/计算日期时间 | - | \`operation\`("now"/"diff"/"add" 默认"now"), \`format\`, \`amount\`(Int), \`unit\`("day"/"hour"...) | \`{{节点.formatted}}\` (默认) / \`{{节点.humanReadable}}\` (diff) |
| \`code_interpreter\` | Python执行 | 数据分析/生成图表 | \`code\` | \`outputFileName\`, \`inputFiles\` | \`{{节点.result}}\` |

> **⚠️ Code Interpreter 最佳实践**:
> 绝大多数情况下，\`code\` 参数不应硬编码。**必须**先连接一个 "Coder LLM"（负责写代码），然后在此节点引用 \`{{CoderNode.response}}\` 执行。

## 5. Branch 节点

### 5.1 参数表
| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| \`condition\` | string | \`\"\"\` | 判断条件表达式 (空则默认返回 true) |

### 5.2 规则
基于 **Regex 白名单** 逐字匹配，**必须**遵循以下格式：

1. **属性访问强制**: 必须引用节点属性 (如 \`Node.data\`), **禁止**直接引用节点名 (如 \`Branch.result > 5\` ❌ → \`Branch.result.value > 5\` ✅)。
2. **逻辑限制**: 仅支持**单条**表达式，严禁 \`&&\`, \`||\`。

- **Condition 语法白名单** (Regex 严格匹配):
  1. 字符串包含: \`Node.field.includes('val')\`
  2. 字符串前缀: \`Node.field.startsWith('val')\`
  3. 字符串后缀: \`Node.field.endsWith('val')\`
  4. 严格相等: \`Node.field === 'val'\` (或 \`=== true\`, \`=== 123\`)
  5. 数值比较: \`Node.field > 10\` (\`<\`, \`>=\`, \`<=\`, \`!==\`)
> ⚠️ **注意**: 必须严格保留 \`Node.field\` 的点号结构 (Regex \`^([a-zA-Z...])\\.([\w.]+)\`)\。

## 6. Output 节点
工作流的最终出口。

### 6.0 配置概览
| 模式 | sources 要求 | 适用场景 | 其他字段 |
|------|-------------|---------|---------|
| \`direct\` | 长度 = 1 | 单 LLM 直出 (最常用) | \`attachments\` 可选 |
| \`select\` | 长度 > 1 | Branch 分支 (输出首个非空值) | \`attachments\` 可选 |
| \`merge\` | 长度 > 1 | 多步骤内容拼接汇总 | \`attachments\` 可选 |
| \`template\` | 不需要 | 格式化报告 | 需配置 \`template\` 字段 |

### 6.1 配置示例
\`\`\`json
{"id": "out", "type": "output", "data": {"label": "最终回复", "inputMappings": {
  "mode": "select",
  "sources": [{"type": "variable", "value": "{{分支A.response}}"}, {"type": "variable", "value": "{{分支B.response}}"}]
}}}
\`\`\`


# 🔗 连接规则
\`\`\`json
{"source": "src_id", "target": "tgt_id", "sourceHandle": "handle_id"}
\`\`\`
- Branch 节点 SourceHandle: \`"true"\` 或 \`"false"\`。
- 其他节点: \`null\` 或不传。
- **DAG 验证**: 禁止环路，Branch 必须接双路。

# ✅ 修改检查清单
1. ⚠️ 修改后的节点 ID 必须与原工作流保持一致
2. ⚠️ 新增节点需正确连接上下游边
3. ⚠️ 删除节点时需同时删除相关边
4. ⚠️ 变量引用使用节点 label（非 ID）

# 输出格式
输出**修改后的完整工作流** JSON（保留未修改的节点）：
\`\`\`json
{"title": "...", "nodes": [...], "edges": [...]}
\`\`\`
`;

    // 将用户请求注入到 system prompt 中
    const finalSystemPrompt = system + "\\n\\n# 用户请求\\n" + prompt;

    const userMsg = "请按照 system prompt 中的规则解析用户需求并生成 JSON 指令。";

    let content = "{}";

    // SiliconFlow API - model from environment variable
    const defaultModel = process.env.DEFAULT_LLM_MODEL || "deepseek-ai/DeepSeek-V3.2";
    const client = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY || "",
      baseURL: "https://api.siliconflow.cn/v1"
    });
    const completion = await client.chat.completions.create({
      model: defaultModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMsg },
      ],
    });
    content = completion.choices?.[0]?.message?.content || "{}";

    // 提取JSON
    let jsonText = content;
    const match = content.match(/\{[\s\S]*\}/);
    if (match) jsonText = match[0];

    let instruction: any = {};
    try {
      instruction = JSON.parse(jsonText);
    } catch {
      instruction = { action: "unknown" };
    }

    return NextResponse.json(instruction);
  } catch (e) {
    console.error("Modify flow error:", e);
    return NextResponse.json({ error: "Failed to process modification" }, { status: 500 });
  }
}