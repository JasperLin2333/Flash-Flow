## 4️⃣ Output 节点(输出节点)

### 功能描述

工作流的**最终出口**，负责收集上游节点的执行结果，根据配置的输出模式对内容进行处理，最终将**文本**回复和**附件**文件返回给用户。

> [!IMPORTANT]
> **生态位**：Output 节点是工作流的**终结器 (Terminator)**。它不产生新数据，仅负责收集、格式化并输出上游已有的数据。所有需要展示给用户的内容（文本或附件）**必须**通过 Output 节点配置。

**核心特性**：
- 🔄 **全局变量收集**：从 `globalFlowContext` 收集所有已执行节点的输出，支持引用任意节点
- 🎯 **多前缀支持**：支持 `{{变量名}}`、`{{节点名.字段}}` 和 `{{节点ID.字段}}` 三种引用方式
- 📦 **类型保留**：内部保留原始变量类型（如文件数组），仅在文本输出时转换为字符串
- ⚡ **流式输出协调**：根据输出模式自动决定上游 LLM 节点的流式策略
- 🔧 **调试模式**：支持注入 mock 数据进行单节点测试

---

### 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|:---:|-------|------|
| `label` | `string` | ❌ | - | 节点显示名称 |
| `inputMappings` | `OutputInputMappings` | ❌ | `undefined` | 输入映射配置对象 |
| `inputMappings.mode` | `OutputMode` | ❌ | `"direct"` | 输出内容的处理模式 |
| `inputMappings.sources` | `ContentSource[]` | ❌ | `[]` | 内容来源列表 (direct/select/merge 模式) |
| `inputMappings.template` | `string` | ❌ | `""` | 模板内容 (template 模式) |
| `inputMappings.attachments` | `AttachmentSource[]` | ❌ | `[]` | 附件来源列表 |

**类型定义** (源自 [flow.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/types/flow.ts#L132-L164))：

```typescript
type OutputMode = 'direct' | 'select' | 'merge' | 'template';

interface ContentSource {
  type: 'variable' | 'static';  // variable: 变量引用 | static: 静态文本
  value: string;                // 变量表达式(如 {{response}})或静态文本
  label?: string;               // 可选的来源说明标签（UI 展示用）
}

interface AttachmentSource {
  type: 'variable' | 'static';  // variable: 变量引用 | static: 静态URL
  value: string;                // 变量引用(如 {{用户输入.files}})或静态 URL
}

interface OutputInputMappings {
  mode: OutputMode;
  sources?: ContentSource[];
  template?: string;
  attachments?: AttachmentSource[];
}

interface OutputNodeData extends BaseNodeData {
  /** @deprecated 此字段已废弃。输出内容通过 inputMappings 动态生成。 */
  text?: string;
  inputMappings?: OutputInputMappings;
}
```

> [!TIP]
> **变量引用语法**：
> - 单字段引用：`{{response}}` - 直接引用上游节点的 response 字段
> - 节点名称前缀：`{{LLM处理.response}}` - 通过节点 label 引用（推荐，可读性高）
> - 节点 ID 前缀：`{{llm-abc123.response}}` - 通过节点 ID 引用（精确匹配）

---

### 输出模式 (Output Modes)

Output 节点支持四种模式，适用于不同的场景：

| 模式 | 标识 (`mode`) | 描述 | 配置项 | 适用场景 |
|-----|--------------|------|-------|---------| 
| **直接引用** | `direct` | 直接输出第一个 source 的内容 | `sources` (仅使用第1个) | 简单流程，直接透传 LLM 回复 |
| **分支选择** | `select` | 按顺序检查，输出**第一个非空且已解析**的结果 | `sources` (多个，按优先级) | 分支流程，不同路径输出不同结果 |
| **内容合并** | `merge` | 将所有**非空且已解析**的来源内容拼接（`\n\n` 分隔） | `sources` (多个，按合并顺序) | 多步骤生成内容，需汇总输出 |
| **模板渲染** | `template` | 使用自定义模板，将变量嵌入固定格式中 | `template` (支持 `{{变量}}` 语法) | 格式化报告、标准化回复 |

**select 模式特殊逻辑**：优先使用流式锁定的源 `lockedSourceId`，若存在则尝试从该节点获取 `response` 字段。

---

### 约束与边界条件

#### 硬约束（运行时报错）

| 约束条件 | 触发模式 | 错误信息 |
|---------|---------|---------|
| `sources.length === 0` | `direct` | `Output 节点配置错误：direct 模式需要至少配置一个来源 (sources)` |
| `sources.length === 0` | `select` | `Output 节点配置错误：select 模式需要至少配置一个来源 (sources)` |
| `sources.length === 0` | `merge` | `Output 节点配置错误：merge 模式需要至少配置一个来源 (sources)` |
| `!template` | `template` | `Output 节点配置错误：template 模式需要配置模板内容 (template)` |
| 未知 mode 值 | 任意 | `Output 节点配置错误：未知的输出模式 "${mode}"` |

#### 逻辑依赖

| 参数 A | 参数 B | 依赖关系 |
|-------|-------|---------|
| `mode = 'template'` | `sources` | `sources` 配置**无效**，UI 隐藏来源配置 |
| `mode ∈ ['direct', 'select', 'merge']` | `template` | `template` 配置**无效**，UI 隐藏模板编辑器 |
| `mode = 'direct'` | `sources` | 仅使用 `sources[0]`，UI 隐藏"添加来源"按钮 |

#### 变量解析规则

- **非空判断**：`resolved.trim() !== ''` 且 `!resolved.includes('{{')` 才算有效
- **未解析跳过**：若变量不存在，`replaceVariables` 保留原始 `{{变量名}}`，此时 select/merge 模式会跳过该 source

---

### 流式输出行为 (Streaming Behavior)

| Output 模式 | 是否流式 | 流式模式 | 行为描述 |
|-------------|---------|---------|---------| 
| **direct** | ✅ | `single` | 只有第一个配置的 source 启用流式 |
| **select** | ✅ | `select` | **首字锁定机制**：多个 LLM 竞速，第一个输出字符的节点锁定通道 |
| **merge** | ✅ | `segmented` | **分段流式**：每个 source 独立输出到对应段落 |
| **template** | ❌ | - | 需等待完整结果进行模板渲染，不流式 |

---

### 附件配置 (Attachments)

Output 节点支持返回文件附件（图片、文档等）。

**支持的附件来源类型**：

| 来源类型 | 示例 | 处理逻辑 |
|---------|------|---------|
| 文件数组 | `{{用户输入.files}}` | 遍历数组，提取每个 `{name, url, type}` |
| 单个文件对象 | `{{代码执行.generatedFile}}` | 直接使用 `{name, url, type}` |
| 图片 URL 字符串 | `{{图片生成.imageUrl}}` | 自动识别为图片，生成文件名和类型 |
| 静态 URL | 直接输入 URL | 从 URL 提取文件名，推断 MIME 类型 |

**图片 URL 识别规则** (源自 [OutputNodeExecutor.ts#L28-L35](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/store/executors/OutputNodeExecutor.ts#L28-L35))：

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

**调试弹窗附件限制**：
- **最大文件数量**：`20` 个
- **单文件最大大小**：`100` MB

---

### 变量收集机制

Output 节点使用 `collectVariablesRaw` 函数从**全局 flowContext** 收集变量：

```typescript
// 使用示例 (OutputNodeExecutor.ts)
const { nodes: allNodes, flowContext: globalFlowContext } = useFlowStore.getState();
const variables = collectVariablesRaw(context, globalFlowContext, allNodes);
```

**变量收集优先级**：
1. **直接上游优先**：直接连接的上游节点输出会**覆盖**全局同名变量
2. **全局补充**：较早执行的节点变量作为补充

**变量前缀生成示例**：
假设上游有节点 `LLM处理` (ID: `llm-abc123`)，输出为 `{ response: "你好" }`，则生成：
- `variables['response']` = "你好"
- `variables['LLM处理.response']` = "你好"
- `variables['llm-abc123.response']` = "你好"

---

### 输出格式 (JSON Structure)

Output 节点的执行结果是标准化的结构：

```typescript
// 节点输出 (output 字段)
{
  text: string,                             // 最终处理后的文本内容
  attachments?: {                           // 仅在配置了有效附件时存在
    name: string,                           // 文件名
    url: string,                            // 文件下载/访问链接
    type?: string                           // MIME类型 (可选)
  }[]
}
```

**ExecutionResult 完整包装**：
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
> Chat 界面会自动识别 `attachments` 字段并在气泡下方渲染为可点击的文件卡片。如果没有 Output 节点，系统会尝试自动提取上游最后一个节点的文本内容，但**无法显示附件**。

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
        { "type": "variable", "value": "{{LLM处理.response}}" }
      ]
    }
  }
}
```

**执行输出**：
```json
{
  "output": { "text": "这是LLM处理节点生成的回复内容..." },
  "executionTime": 12
}
```

---

#### 示例 2: 分支选择模式 (select)
```json
{
  "id": "output-002",
  "type": "output",
  "data": {
    "label": "分支输出",
    "inputMappings": {
      "mode": "select",
      "sources": [
        { "type": "variable", "value": "{{专业回复.response}}", "label": "专业模式" },
        { "type": "variable", "value": "{{简洁回复.response}}", "label": "简洁模式" },
        { "type": "static", "value": "抱歉,暂时无法处理您的请求", "label": "兜底回复" }
      ]
    }
  }
}
```

**执行输出**（假设"简洁回复"节点先完成）：
```json
{
  "output": { "text": "这是简洁回复节点生成的内容" },
  "executionTime": 856
}
```

---

#### 示例 3: 内容合并模式 (merge)
```json
{
  "id": "output-003",
  "type": "output",
  "data": {
    "label": "合并输出",
    "inputMappings": {
      "mode": "merge",
      "sources": [
        { "type": "variable", "value": "{{分析师.response}}", "label": "分析内容" },
        { "type": "variable", "value": "{{总结者.response}}", "label": "总结内容" }
      ]
    }
  }
}
```

**执行输出**：
```json
{
  "output": { "text": "分析师的详细分析内容...\n\n总结者的总结归纳..." },
  "executionTime": 2134
}
```

---

#### 示例 4: 模板渲染模式 (template)
```json
{
  "id": "output-004",
  "type": "output",
  "data": {
    "label": "报告输出",
    "inputMappings": {
      "mode": "template",
      "template": "## 数据分析报告\n\n### 摘要\n{{LLM分析.summary}}\n\n### 结论\n{{LLM分析.conclusion}}"
    }
  }
}
```

---

#### 示例 5: 带附件的输出（最复杂场景）
```json
{
  "id": "output-005",
  "type": "output",
  "data": {
    "label": "图文输出",
    "inputMappings": {
      "mode": "direct",
      "sources": [
        { "type": "variable", "value": "{{LLM描述.response}}" }
      ],
      "attachments": [
        { "type": "variable", "value": "{{图片生成.imageUrl}}" },
        { "type": "variable", "value": "{{用户输入.files}}" },
        { "type": "static", "value": "https://example.com/fixed-doc.pdf" }
      ]
    }
  }
}
```

**执行输出**：
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
      },
      {
        "name": "fixed-doc.pdf",
        "url": "https://example.com/fixed-doc.pdf",
        "type": "application/pdf"
      }
    ]
  },
  "executionTime": 1523
}
```

---

### 调试模式 (Mock Data)

Output 节点支持通过 `context.mock` 注入模拟数据进行单节点测试：

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

---

### 常见问题 (FAQ)

#### Q: 为什么 select 模式需要检查 `!resolved.includes('{{')` ?
A: 防止输出未解析的变量引用。如果变量不存在，`replaceVariables` 会保留原始的 `{{变量名}}`，此时应跳过该 source，尝试下一个来源。

#### Q: merge 模式下段落顺序如何控制?
A: 段落顺序由 `sources` 数组的顺序决定。系统按配置顺序初始化段落。

#### Q: template 模式为什么不支持流式?
A: 模板渲染需要等待所有变量就绪后一次性替换，无法实现增量输出。

#### Q: 附件的 URL 如何生成?
A: 附件 URL 由上游节点（如 Input、ImageGen）负责生成。Output 节点仅负责收集和透传。

---

### 相关文件

**核心实现**：
- [OutputNodeExecutor.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/store/executors/OutputNodeExecutor.ts) - 执行器主逻辑
- [variableUtils.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/store/executors/utils/variableUtils.ts) - 变量收集工具 (`collectVariablesRaw`)

**类型定义**：
- [flow.ts#L132-L164](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/types/flow.ts#L132-L164) - OutputNodeData, OutputMode, ContentSource, AttachmentSource

**UI 配置**：
- [OutputNodeConfig.tsx](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/components/builder/context-hud/OutputNodeConfig.tsx) - 节点配置面板
- [OutputNodeForm.tsx](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/components/builder/node-forms/OutputNodeForm.tsx) - 节点表单
- [OutputDebugDialog.tsx](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/components/flow/OutputDebugDialog.tsx) - 调试对话框

**常量定义**：
- [outputModeConstants.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/lib/outputModeConstants.ts) - 输出模式选项
