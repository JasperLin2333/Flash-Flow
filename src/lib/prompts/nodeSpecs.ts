export const NODE_SPECS = `
# 📦 节点参数详解 (Strict Code-Grounding)

## 1. Input 节点 (用户输入入口)

### 1.0 参数表
| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| \`enableTextInput\` | boolean | \`true\` | 启用文本输入框 |
| \`enableFileInput\` | boolean | \`false\` | 启用文件上传 |
| \`enableStructuredForm\` | boolean | \`false\` | 启用结构化表单 |
| \`greeting\` | string | \`"""\` | 招呼语，引导用户如何使用 |
| \`fileConfig.allowedTypes\` | string[] | \`["*/*"]\` | 允许的文件类型 |
| \`fileConfig.maxSizeMB\` | number | \`100\` | 单文件最大 MB (1-100) |
| \`fileConfig.maxCount\` | number | \`10\` | 最大文件数量 (1-10) |

> 🔴 **输入配置铁律**
> - 涉及 **文件/图片/文档** → \`enableFileInput: true\` + \`fileConfig.allowedTypes\`
> - 涉及 **可选模式/风格/策略** → \`enableStructuredForm: true\` + \`formFields\`
> - **greeting** 招呼语：用 1-2 句话引导用户使用，如 "上传文档，我帮你分析"

### 1.1 allowedTypes 常用值
| 文件类型 | allowedTypes |
|---------|-------------|
| 图片 | \`[".png,.jpg,.jpeg,.webp"]\` |
| PDF | \`[".pdf"]\` |
| 文档 | \`[".doc,.docx"]\` |
| 表格 | \`[".csv", ".xls,.xlsx"]\` |

### 1.2 formFields 字段类型
| type | 说明 | 必填属性 | 可选属性 |
|------|------|---------|---------| 
| \`text\` | 文本框 | \`name\`, \`label\` | \`required\`, \`defaultValue\`, \`placeholder\` |
| \`select\` | 单选下拉 | \`name\`, \`label\`, \`options\`[] | \`required\`, \`defaultValue\` |
| \`multi-select\` | 多选下拉 | \`name\`, \`label\`, \`options\`[] | \`required\`, \`defaultValue\` |

### 1.3 输出变量
- \`{{节点.user_input}}\`: 用户输入的文本
- \`{{节点.files}}\`: 上传的文件数组 (含 name, url, type, size)
- \`{{节点.formData}}\`: 表单数据对象

### 1.4 完整示例
\`\`\`json
{"id": "input_1", "type": "input", "data": {
  "label": "用户输入",
  "enableTextInput": true,
  "enableFileInput": true,
  "fileConfig": {"allowedTypes": [".pdf"], "maxSizeMB": 10, "maxCount": 5},
  "enableStructuredForm": true,
  "formFields": [
    {"type": "text", "name": "keyword", "label": "关键词", "required": true},
    {"type": "select", "name": "mode", "label": "模式", "options": ["简洁", "详细"], "defaultValue": "简洁"}
  ],
  "greeting": "请输入您的问题，我来帮您分析！"
}}
\`\`\`

---

## 2. LLM 节点 (大语言模型)

### 2.0 参数表
| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| \`model\` | string | \`deepseek-ai/DeepSeek-V3.2\` | 模型选择 |
| \`temperature\` | number | \`0.7\` | 0.0-1.0 (低=确定性, 高=创造性) |
| \`systemPrompt\` | string | \`""\` | 系统提示词，支持 \`{{变量}}\` |
| \`enableMemory\` | boolean | \`false\` | 启用多轮对话记忆 |
| \`memoryMaxTurns\` | number | \`10\` | 最大记忆轮数 (1-20) |
| \`responseFormat\` | string | \`"text"\` | \`"text"\` / \`"json_object"\` |

> 🔴 **核心铁律**
> - \`responseFormat: "json_object"\` 时，**必须**在 systemPrompt 中说明输出 JSON 格式
> - 文件/图片处理 → **先接 RAG 节点**，LLM 引用 \`{{RAG.documents}}\`

> 🔴 **user_input 二选一，禁止重复！**
> | 方式 | 场景 | 示例 |
> |------|------|------|
> | **inputMappings.user_input** | 简单对话 | \`inputMappings: {user_input: "{{输入.user_input}}"}\` |
> | **systemPrompt 内引用** | 复杂场景 | \`systemPrompt: "分析 {{输入.user_input}} ..."\` |

> 🧠 **记忆说明**
> - 每个 LLM 节点独立维护自己的对话历史，互不干扰
> - \`memoryMaxTurns\` 控制保留的最大轮数

### 2.1 可用模型
| model 值 | 说明 |
|---------|------|
| \`deepseek-ai/DeepSeek-V3.2\` | DeepSeek-V3.2 (默认) |
| \`deepseek-reasoner\` | DeepSeek-R1 (推理模型) |
| \`deepseek-v3-2-251201\` | DeepSeek-V3.2 (火山引擎) |
| \`doubao-1-5-pro-32k-character-250715\` | doubao-1.5-pro |
| \`qwen-flash\` | 千问模型-快速 |

### 2.2 输出变量
- \`{{节点.response}}\`: 生成的回复内容
- \`{{节点.reasoning}}\`: 推理模型的思维链

---

## 3. RAG 节点 (检索增强生成)

> 🔴 **文件处理铁律**
> - 涉及**文档/PDF/图片分析** → **必须**使用 RAG 节点
> - ❌ 禁止将 \`{{xx.files}}\` 直接传给 LLM
> - ✅ 正确流程: Input(上传) → RAG(解析) → LLM(基于 \`{{RAG.documents}}\` 分析)

### 3.0 参数表
| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| \`retrievalMode\` | string | \`"static"\` | \`"variable"\` (动态) / \`"static"\` (静态) |
| \`retrievalVariable\` | string | - | 动态文件引用 1 (如 \`{{输入.files}}\`) |
| \`retrievalVariable2\` | string | - | 动态文件引用 2 |
| \`retrievalVariable3\` | string | - | 动态文件引用 3 |
| \`inputMappings.query\` | string | - | 检索查询内容 (如 \`{{输入.user_input}}\`) |
| \`inputMappings.files\` | string | - | 兼容旧版动态文件引用 |
| \`maxTokensPerChunk\` | number | \`200\` | 静态模式分块大小 (50-500) |
| \`maxOverlapTokens\` | number | \`20\` | 静态模式重叠大小 (0-100) |

### 3.1 模式选择
| 模式 | 场景 | 配置 |
|------|------|------|
| **动态** | 用户上传文件 | \`retrievalVariable: "{{输入.files}}"\` |
| **静态** | 预设知识库 | 在 UI 预上传文件 |

### 3.2 输出变量
- \`{{节点.query}}\`: 执行的查询
- \`{{节点.documents}}\`: 检索到的文档片段数组
- \`{{节点.citations}}\`: 引用来源信息
- \`{{节点.documentCount}}\`: 文档数量
- \`{{节点.mode}}\`: 执行模式 (\`fileSearch\` / \`multimodal\`)

### 3.3 完整示例
\`\`\`json
{"id": "rag_1", "type": "rag", "data": {
  "label": "文档问答",
  "retrievalMode": "variable",
  "retrievalVariable": "{{用户输入.files}}",
  "inputMappings": {"query": "{{用户输入.user_input}}"}
}}
\`\`\`

---

## 4. Tool 节点 (工具调用)

> ⚠️ **参数铁律**
> - **数值参数** (\`maxResults\`, \`maxLength\`): 必须是**静态数值**，禁止 \`{{变量}}\`
> - **字符串参数** (\`query\`, \`url\`): 支持 \`{{变量}}\` 引用

### 4.0 可用工具
| 工具 ID | 说明 | 必填 inputs | 选填 inputs | 输出变量 |
|---------|------|-------------|-------------|----------|
| \`web_search\` | 网页搜索 | \`query\` | \`maxResults\` (1-10, 默认5) | \`{{节点.results}}\`, \`{{节点.count}}\` |
| \`url_reader\` | 读取网页 | \`url\` | \`maxLength\` (100-50000) | \`{{节点.content}}\`, \`{{节点.title}}\` |
| \`calculator\` | 数学计算 | \`expression\` | - | \`{{节点.result}}\` |
| \`datetime\` | 日期时间 | \`operation\` | 见下方 | \`{{节点.formatted}}\`, \`{{节点.timestamp}}\` |
| \`code_interpreter\` | Python执行 | \`code\` | \`inputFiles\`, \`outputFileName\` | \`{{节点.logs}}\`, \`{{节点.result}}\`, \`{{节点.errors}}\`, \`{{节点.generatedFile}}\` |

### 4.1 datetime 工具配置
| operation | 说明 | 额外参数 |
|-----------|------|----------|
| \`now\` | 获取当前时间 (默认) | \`format\` |
| \`format\` | 格式化日期 | \`date\`, \`format\` |
| \`diff\` | 日期差值 | \`date\`, \`targetDate\` |
| \`add\` | 日期加减 | \`date\`, \`format\`, \`amount\`, \`unit\` |

> 💡 **unit 枚举值**: \`year\` / \`month\` / \`day\` / \`hour\` / \`minute\` / \`second\`

### 4.2 完整示例
\`\`\`json
{"id": "tool_1", "type": "tool", "data": {
  "label": "搜索资讯",
  "toolType": "web_search",
  "inputs": {"query": "{{用户输入.user_input}}", "maxResults": 5}
}}
\`\`\`

---

## 5. Branch 节点 (条件分支)

### 5.0 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| \`condition\` | string | 判断条件表达式 (空则返回 true) |

### 5.1 支持的表达式格式

**基础条件**:
| 类型 | 语法 | 示例 |
|------|------|------|
| 包含 | \`节点.字段.includes('值')\` | \`输入.user_input.includes('http')\` |
| 前缀 | \`节点.字段.startsWith('值')\` | \`输入.text.startsWith('查询')\` |
| 后缀 | \`节点.字段.endsWith('值')\` | \`文件.name.endsWith('.pdf')\` |
| 相等 | \`节点.字段 === 值\` | \`表单.mode === '简洁'\` |
| 不等 | \`节点.字段 !== 值\` | \`状态.type !== 'error'\` |
| 比较 | \`节点.字段 > 数值\` | \`评分.score >= 60\` |

**逻辑组合**:
| 运算符 | 语法 | 示例 |
|--------|------|------|
| AND | \`条件1 && 条件2\` | \`用户.age >= 18 && 用户.verified === true\` |
| OR | \`条件1 \\|\\| 条件2\` | \`类型 === 'image' \\|\\| 类型 === 'video'\` |

> ⚠️ 运算符前后需要空格 (\` && \` 而非 \`&&\`)

### 5.2 输出变量
- \`{{节点.conditionResult}}\`: 判断结果 (true/false)
- \`{{节点.passed}}\`: 节点执行成功 (固定 true)
- 透传上游节点所有字段 (过滤 \`_\` 开头的内部字段)

### 5.3 路径激活规则
- \`conditionResult = true\` → 激活 \`true\` 句柄下游，阻塞 \`false\` 句柄
- \`conditionResult = false\` → 激活 \`false\` 句柄下游，阻塞 \`true\` 句柄

---

## 6. Output 节点 (最终输出)

### 6.0 输出模式
| 模式 | sources 要求 | 适用场景 |
|------|-------------|----------|
| `direct` | 1 个 | 单一 LLM 直出 (最常用) |
| `select` | ≥1 个 | 分支场景，输出首个非空值 |
| `merge` | ≥1 个 | 多源拼接 (双换行分隔) |
| `template` | 不需要 | 自定义模板渲染 |

### 6.1 配置参数
| 参数 | 类型 | 说明 |
|------|------|------|
| `inputMappings.mode` | enum | `direct` / `select` / `merge` / `template` |
| `inputMappings.sources` | array | 内容来源列表 `[{ "type": "variable", "value": "..." }]` |
| `inputMappings.template` | string | 模板内容 (template 模式专用) |
| `inputMappings.attachments` | array | 附件列表 `[{ "type": "variable", "value": "..." }]` |

### 6.2 常用示例
#### (1) 普通输出 (direct)
```json
{
  "id": "output_1", "type": "output", "data": {
    "label": "最终输出",
      "inputMappings": {
      "mode": "direct",
        "sources": [{ "type": "variable", "value": "{{LLM.response}}" }]
    }
  }
}
```

#### (2) 模板报告 (template) - 适合生成报告
```json
{
  "id": "output_2", "type": "output", "data": {
    "label": "报告输出",
      "inputMappings": {
      "mode": "template",
        "template": "## 总结\n{{LLM.summary}}\n\n## 建议\n{{LLM.advice}}"
    }
  }
}
```

#### (3) 带附件输出
```json
{
  "id": "output_3", "type": "output", "data": {
    "label": "图文回复",
      "inputMappings": {
      "mode": "direct",
        "sources": [{ "type": "variable", "value": "{{LLM.text}}" }],
          "attachments": [{ "type": "variable", "value": "{{ImageGen.imageUrl}}" }]
    }
  }
}
```

> 💡 **关键铁律**:
> - `template` 模式必填 `template` 字段，忽略 `sources`
> - `direct`/`merge`/`select` 模式必填 `sources`
> - 附件 `attachments` 可选，支持文件数组或图片 URL

---

## 7. ImageGen 节点 (图片生成)

### 7.0 参数表 (通用)
| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| \`model\` | string | \`Kwai-Kolors/Kolors\` | 模型选择 |
| \`prompt\` | string | \`""\` | 图片描述，支持 \`{{变量}}\` |
| \`negativePrompt\` | string | \`""\` | 反向提示词 |
| \`imageSize\` | string | \`1024x1024\` | 尺寸 (详见 7.2) |
| \`cfg\` | number | \`7.0\` | 创意系数 (0-20) |
| \`numInferenceSteps\` | number | \`30\` | 推理步数 (1-50) |

### 7.1 可用模型与能力
| model 值 | 说明 | 特性 |
|---------|------|------|
| \`Kwai-Kolors/Kolors\` | 可灵 (默认) | 中文理解好, 仅文生图 |
| \`Qwen/Qwen-Image\` | 千问-文生图 | 通用文生图 |
| \`Qwen/Qwen-Image-Edit-2509\` | 千问-图生图 | **必须提供参考图**, 仅图生图 |

### 7.2 参考图配置 (关键)
仅 \`Qwen-Image-Edit-2509\` 或其他图生图模型需要。
**模式 (\`referenceImageMode\`)**:
- \`"static"\`: 使用 UI 上传的静态 URL (\`referenceImageUrl\`...)
- \`"variable"\`: 使用变量 (\`referenceImageVariable\`...)

| 参数 | 说明 |
|------|------|
| \`referenceImageVariable\` | 主图变量 (如 \`{{输入.files[0].url}}\`) |
| \`referenceImage2Variable\` | 副图变量 |
| \`referenceImage3Variable\` | 副图变量 |

### 7.3 完整示例 (图生图)
\`\`\`json
{"id": "img_gen_1", "type": "imagegen", "data": {
  "label": "风格重绘",
  "model": "Qwen/Qwen-Image-Edit-2509",
  "prompt": "变成赛博朋克风格",
  "referenceImageMode": "variable",
  "referenceImageVariable": "{{输入.files[0].url}}",
  "cfg": 4.0,
  "numInferenceSteps": 50
}}
\`\`\`

### 7.4 输出变量
- \`{{节点.imageUrl}}\`: 生成的图片 URL

---

## 8. 变量引用机制

### 8.1 引用格式
| 格式 | 说明 | 示例 |
|------|------|------|
| \`{{字段名}}\` | 直接引用 | \`{{response}}\` |
| \`{{节点名.字段}}\` | 节点 label 前缀 (**推荐**) | \`{{LLM处理.response}}\` |
| \`{{节点ID.字段}}\` | 节点 ID 前缀 | \`{{llm_abc.response}}\` |

> 💡 支持嵌套路径: \`{{节点.data.field}}\`, \`{{节点.formData.key}}\`

### 8.2 变量优先级
1. **直接上游** context (最高)
2. **全局** flowContext

---

## 9. 工作流编排规则

### 9.1 执行顺序
- 按拓扑层级**并行执行**同层节点
- 等当前层级全部完成后执行下一层

### 9.2 禁止循环依赖
- 系统自动检测，有循环则中止执行

### 9.3 Branch 路径阻塞
- 未选中的分支路径及其所有下游节点不会执行
`;
