## 4️⃣ Output 节点(输出节点)

### 功能描述
工作流的**最终出口**,如果不连接 Output 节点,工作流执行完成后可能无法在前端正确显示结果。
Output 节点负责收集上游节点的执行结果,并根据配置的**输出模式**(direct/select/merge/template)对内容进行处理,最终将**文本**回复和**附件**文件返回给用户。

**核心特性**:
- 🔄 **全局变量收集**: 自动从**全局 flowContext** 收集所有已执行节点的输出变量,支持引用任意节点
- 🎯 **多前缀支持**: 支持 `{{变量名}}`、`{{节点名.字段}}` 和 `{{节点ID.字段}}` 三种引用方式
- 📦 **类型保留**: 内部保留原始变量类型(如文件数组),仅在文本输出时转换为字符串
- ⚡ **流式输出协调**: 根据输出模式自动决定上游 LLM 节点的流式策略
- 🔧 **调试模式**: 支持注入 mock 数据进行单节点测试

### 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|-----|-------|------|
| `label` | string | ✅ | - | 节点显示名称 |
| `inputMappings.mode` | OutputMode | ❌ | `"direct"` | 输出内容的处理模式 (见下文) |
| `inputMappings.sources` | ContentSource[] | ❌ | `[]` | 内容来源列表 (direct/select/merge 模式使用) |
| `inputMappings.template` | string | ❌ | `""` | 模板内容 (template 模式使用) |
| `inputMappings.attachments` | AttachmentSource[] | ❌ | `[]` | 附件来源列表 |

**类型定义**:
```typescript
type OutputMode = 'direct' | 'select' | 'merge' | 'template';

interface ContentSource {
  type: 'variable' | 'static';  // variable: 变量引用 | static: 静态文本
  value: string;                // 变量表达式(如 {{response}})或静态文本
  label?: string;               // 可选的来源说明标签
}

interface AttachmentSource {
  type: 'variable' | 'static';  // 目前主要支持 variable
  value: string;                // 文件变量引用(如 {{用户输入.files}})
}

interface OutputInputMappings {
  mode: OutputMode;
  sources?: ContentSource[];
  template?: string;
  attachments?: AttachmentSource[];
}

interface OutputNodeData extends BaseNodeData {
  text?: string;
  inputMappings?: OutputInputMappings;
}
```

> [!TIP]
> **变量引用语法**:
> - 单字段引用: `{{response}}` - 直接引用上游节点的 response 字段
> - 节点名称前缀: `{{LLM处理.response}}` - 通过节点 label 引用(推荐,可读性高)
> - 节点 ID 前缀: `{{llm-abc123.response}}` - 通过节点 ID 引用(精确匹配)
> - 系统会自动收集**所有已执行节点**的输出,并生成带前缀的变量供引用

### 输出模式 (Output Modes)

Output 节点支持四种模式,适用于不同的场景:

| 模式 | 标识 (`mode`) | 描述 | 配置项 | 适用场景 |
|-----|--------------|------|-------|---------| 
| **直接引用** | `direct` | 直接输出单一来源的内容 | `sources` (仅限1个) | 简单流程,直接透传 LLM 回复 |
| **分支选择** | `select` | 按顺序检查来源,输出**第一个非空且已解析**的结果(跳过含 `{{}}` 的值) | `sources` (多个,按优先级排序) | 分支流程 (Branch),不同路径产生不同结果 |
| **内容合并** | `merge` | 将所有**非空且已解析**的来源内容**拼接**在一起(双换行分隔) | `sources` (多个,按合并顺序) | 多步骤生成内容,需要汇总输出 |
| **模板渲染** | `template` | 使用自定义模板,将变量嵌入固定文本格式中 | `template` (支持 {{变量}} 语法) | 格式化报告、标准化回复 |

**模式校验规则**:
- `direct` 模式: 至少配置 1 个 source,否则抛出错误
- `select` 模式: 至少配置 1 个 source,否则抛出错误
- `merge` 模式: 至少配置 1 个 source,否则抛出错误
- `template` 模式: 必须配置 template 内容,否则抛出错误

### 流式输出行为 (Streaming Behavior)

Output 节点的模式会影响上游 LLM 节点的流式输出策略:

| Output 模式 | 是否流式 | 流式模式 | 行为描述 |
|-------------|---------|---------|---------|
| **direct** | ✅ | `single` | 只有第一个配置的 source 启用流式 |
| **select** | ✅ | `select` | **首字锁定机制**: 多个 LLM 竞速,第一个输出字符的节点锁定通道 |
| **merge** | ✅ | `segmented` | **分段流式**: 每个 source 独立输出到对应段落 |
| **template** | ❌ | - | 需等待完整结果进行模板渲染,不流式 |

### 附件配置 (Attachments)

Output 节点支持返回文件附件(如生成的图片、文档等)。
在配置面板底部的"附件 (可选)"区域添加来源。

**支持类型**:
- **文件数组**: 如 `{{用户输入.files}}` (透传用户上传的文件)
- **单文件对象**: 如 `{{代码执行.generatedFile}}` (返回代码生成的单个文件)
- **图片 URL 字符串**: 如 `{{图片生成.imageUrl}}` (支持 Supabase Storage URL 或常见图片扩展名)

**图片 URL 识别逻辑**:
```typescript
function isImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  // 检查常见图片扩展名
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|$)/i.test(url)) return true;
  // 检查 Supabase Storage URL
  if (url.includes('supabase') && url.includes('/storage/')) return true;
  return false;
}
```

### 变量收集机制

Output 节点使用 `collectVariablesRaw` 函数从**全局 flowContext** 收集变量:

```typescript
// 使用示例 (OutputNodeExecutor.ts)
const { nodes: allNodes, flowContext: globalFlowContext } = useFlowStore.getState();

// 收集全局变量（保留原始类型）- 支持引用任意已执行节点
const variables = collectVariablesRaw(context, globalFlowContext, allNodes);
```

**变量收集优先级**:
1. **直接上游优先**: 直接连接的上游节点输出会覆盖全局同名变量
2. **全局补充**: 较早执行的节点变量作为补充,可被上游覆盖

**变量前缀示例**:
假设上游有节点 `LLM处理` (ID: `llm-abc123`),输出为 `{ response: "你好" }`,则生成:
- `variables['response']` = "你好"
- `variables['LLM处理.response']` = "你好"
- `variables['llm-abc123.response']` = "你好"

### 输出格式 (JSON Structure)

Output 节点的执行结果是标准化的结构,Chat 界面会解析此结构进行展示:

```typescript
{
  "text": string,                             // 最终处理后的文本内容
  
  // 仅在配置了有效附件时存在
  "attachments"?: [
    {
      "name": string,                         // 文件名
      "url": string,                          // 文件下载/访问链接
      "type"?: string                         // MIME类型 (可选)
    }
  ]
}
```

**ExecutionResult 包装**:
```typescript
{
  output: {
    text: string,
    attachments?: { name: string; url: string; type?: string }[]
  },
  executionTime: number  // 执行耗时(毫秒)
}
```

> [!NOTE]
> Chat 界面会自动识别 `attachments` 字段并在气泡下方渲染为可点击的文件卡片。
> 如果没有 Output 节点,系统会尝试自动提取上游最后一个节点的文本内容,但**无法显示附件**。

---

### 完整运行示例 (JSON)

#### 示例 1: 直接引用模式 (direct)
```json
{
  "id": "output-001",
  "type": "output",
  "position": { "x": 400, "y": 100 },
  "data": {
    "label": "最终输出",
    "inputMappings": {
      "mode": "direct",
      "sources": [
        {
          "type": "variable",
          "value": "{{LLM处理.response}}"
        }
      ]
    }
  }
}
```

**执行输出**:
```json
{
  "output": {
    "text": "这是LLM处理节点生成的回复内容..."
  },
  "executionTime": 12
}
```

#### 示例 2: 分支选择模式 (select)
```json
{
  "id": "output-002",
  "type": "output",
  "position": { "x": 600, "y": 200 },
  "data": {
    "label": "分支输出",
    "inputMappings": {
      "mode": "select",
      "sources": [
        {
          "type": "variable",
          "value": "{{专业回复.response}}",
          "label": "专业模式"
        },
        {
          "type": "variable", 
          "value": "{{简洁回复.response}}",
          "label": "简洁模式"
        },
        {
          "type": "static",
          "value": "抱歉,暂时无法处理您的请求",
          "label": "兜底回复"
        }
      ]
    }
  }
}
```

**执行输出** (假设"简洁回复"节点先完成):
```json
{
  "output": {
    "text": "这是简洁回复节点生成的内容"
  },
  "executionTime": 856
}
```

#### 示例 3: 内容合并模式 (merge)
```json
{
  "id": "output-003",
  "type": "output",
  "position": { "x": 800, "y": 300 },
  "data": {
    "label": "合并输出",
    "inputMappings": {
      "mode": "merge",
      "sources": [
        {
          "type": "variable",
          "value": "{{分析师.response}}",
          "label": "分析内容"
        },
        {
          "type": "variable",
          "value": "{{总结者.response}}",
          "label": "总结内容"
        }
      ]
    }
  }
}
```

**执行输出**:
```json
{
  "output": {
    "text": "分析师的详细分析内容...\n\n总结者的总结归纳..."
  },
  "executionTime": 2134
}
```

#### 示例 4: 模板渲染模式 (template)
```json
{
  "id": "output-004",
  "type": "output",
  "position": { "x": 1000, "y": 400 },
  "data": {
    "label": "报告输出",
    "inputMappings": {
      "mode": "template",
      "template": "## 数据分析报告\n\n### 摘要\n{{LLM分析.summary}}\n\n### 关键指标\n{{数据处理.metrics}}\n\n### 结论\n{{LLM分析.conclusion}}"
    }
  }
}
```

**执行输出**:
```json
{
  "output": {
    "text": "## 数据分析报告\n\n### 摘要\n本次分析涵盖了...\n\n### 关键指标\n- 指标A: 95%\n- 指标B: 1200\n\n### 结论\n综合以上分析..."
  },
  "executionTime": 45
}
```

#### 示例 5: 带附件的输出
```json
{
  "id": "output-005",
  "type": "output",
  "position": { "x": 1200, "y": 500 },
  "data": {
    "label": "图文输出",
    "inputMappings": {
      "mode": "direct",
      "sources": [
        {
          "type": "variable",
          "value": "{{LLM描述.response}}"
        }
      ],
      "attachments": [
        {
          "type": "variable",
          "value": "{{图片生成.imageUrl}}"
        },
        {
          "type": "variable",
          "value": "{{用户输入.files}}"
        }
      ]
    }
  }
}
```

**执行输出**:
```json
{
  "output": {
    "text": "根据您的要求,我已生成了以下图片...",
    "attachments": [
      {
        "name": "generated_image_1735654800000.png",
        "url": "https://xxx.supabase.co/storage/v1/object/public/images/xxx.png",
        "type": "image/png"
      },
      {
        "name": "user_upload.pdf",
        "url": "https://xxx.supabase.co/storage/v1/object/public/files/xxx.pdf",
        "type": "application/pdf"
      }
    ]
  },
  "executionTime": 1523
}
```

---

### 调试模式 (Mock Data)

Output 节点支持通过 `context.mock` 注入模拟数据进行单节点测试:

```typescript
// 调试时传入 mock 数据
const mockData = context.mock as Record<string, unknown> | undefined;
if (mockData && typeof mockData === 'object') {
  for (const [key, value] of Object.entries(mockData)) {
    stringVariables[key] = valueToString(value);
    variables[key] = value;
  }
}
```

**调试示例**:
```typescript
// 单节点测试时的上下文
const context = {
  mock: {
    "LLM处理.response": "这是模拟的LLM回复",
    "用户输入.files": [{ name: "test.pdf", url: "https://..." }]
  }
};
```

---

### 常见问题 (FAQ)

#### Q: 为什么 select 模式需要检查 `!resolved.includes('{{')`?
A: 防止输出未解析的变量引用。如果变量不存在,`replaceVariables` 会保留原始的 `{{变量名}}`,此时应跳过该 source,尝试下一个来源。

#### Q: merge 模式下段落顺序如何控制?
A: 段落顺序由 `sources` 数组的顺序决定。系统会按照配置顺序初始化段落,并依次激活流式输出。

#### Q: template 模式为什么不支持流式?
A: 模板渲染需要等待所有变量就绪后一次性替换,无法实现增量输出。如需流式,请使用 merge 模式。

#### Q: 如何实现多个分支的兜底逻辑?
A: 使用 select 模式,按优先级配置多个 source,最后一个配置为静态文本兜底:
```
sources: [
  { type: 'variable', value: '{{分支A.result}}' },
  { type: 'variable', value: '{{分支B.result}}' },
  { type: 'static', value: '抱歉,暂无结果' }  // 静态兜底
]
```

#### Q: 附件的 URL 如何生成?
A: 附件 URL 由上游节点(如 Input、ImageGen)负责生成。Output 节点仅负责收集和透传,不处理文件上传或 URL 生成逻辑。

#### Q: 如何引用图片生成节点的输出?
A: 使用 `{{图片生成.imageUrl}}` 作为附件来源。系统会自动识别 Supabase Storage URL 或常见图片扩展名,并转换为标准附件格式。

---

### 相关文件

**核心实现**:
- `src/store/executors/OutputNodeExecutor.ts` - 执行器主逻辑
- `src/store/executors/utils/variableUtils.ts` - 变量收集工具 (`collectVariablesRaw`)
- `src/store/executors/LLMNodeExecutor.ts` - 流式配置检测 (`getStreamingConfig`)

**类型定义**:
- `src/types/flow.ts` - OutputNodeData, OutputMode, ContentSource, AttachmentSource

**UI 配置**:
- `src/components/builder/context-hud/OutputNodeConfig.tsx` - 节点配置面板
- `src/components/builder/node-forms/OutputNodeForm.tsx` - 节点表单
- `src/components/flow/OutputDebugDialog.tsx` - 调试对话框

**流式管理**:
- `src/store/actions/streamingActions.ts` - 流式状态管理
- `src/store/actions/executionActions.ts` - 流式初始化逻辑

**工具函数**:
- `src/lib/promptParser.ts` - 变量替换 (`replaceVariables`)
- `src/store/utils/sourceResolver.ts` - 源节点解析 (`resolveSourceNodeId`)
