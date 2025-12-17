# RAG 节点 (检索增强生成节点)

## 功能描述

使用 Google Gemini 的能力进行文档检索，支持两种工作模式：

1.  **静态模式 (Static Mode)**：使用 Builder 中预上传的知识库文件。底层基于 Gemini File Search Store。适用于固定的知识库问答。
2.  **动态模式 (Dynamic Mode)**：从上游 Input 节点引用用户上传的文件。底层基于 Gemini 多模态 API。适用于针对用户上传文件的即时问答。

## 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|-----|-------|------|
| `label` | string | ✅ | - | 节点显示名称 |
| `files` | File[] | ❌ | `[]` | 知识库文件列表（仅静态模式） |
| `fileSearchStoreName` | string | ❌ | - | File Search Store 名称 (自动创建) |
| `fileSearchStoreId` | string | ❌ | - | Store 显示 ID (用户友好) |
| `topK` | number | ❌ | `5` | 检索结果数量 (1/3/5/7/10) |
| `maxTokensPerChunk` | number | ❌ | `200` | 静态分块大小 (50-500 tokens) |
| `maxOverlapTokens` | number | ❌ | `20` | 静态分块重叠 (0-100 tokens) |
| `uploadStatus` | string | ❌ | `"idle"` | 上传状态 (`idle`/`uploading`/`processing`/`completed`/`error`) |
| `uploadError` | string | ❌ | - | 上传错误信息 |

### 输入映射参数 (`inputMappings`)

| 参数名 | 类型 | 描述 |
|-------|------|------|
| `inputMappings.query` | string | 检索查询内容模板，支持 `{{变量}}` 语法 |
| `inputMappings.files` | string | 动态文件引用，如 `{{用户输入.files}}` |

> [!NOTE]
> **文件支持**: `.pdf`, `.txt`, `.md`, `.doc`, `.docx`。
> **限制**: 单个文件最大 100MB。只在静态模式下需要预先"上传"文件到 Store。

## 核心执行逻辑 (Execution Logic)

### 1. 模式选择 (Mode Selection)

系统根据 `inputMappings` 的配置自动判断运行模式：

*   **动态模式**: 如果 `inputMappings.files` 被配置且解析出了有效的 URL，系统将优先使用动态多模态 API 直接处理这些文件。
*   **静态模式**: 如果没有配置动态文件，系统将回退到使用预配置的 File Search Store 进行检索。

### 2. 查询解析 (Query Resolution)

检索查询文本 (`query`) 是必须的。
*   优先使用 `inputMappings.query` 中配置的模板（支持 `{{variable}}`）。
*   如果未配置，尝试自动从上游 Context 中提取 (`extractInputFromContext`)。

### 3. 动态文件解析 (Dynamic Resolution)

当使用动态模式时，系统支持解析以下格式的变量：

*   **文件数组**: 如 `{{InputNode.files}}`。系统会过滤其中包含 `url` 的有效文件对象。
*   **单文件对象**: 包含 `url` 的对象 (会自动包装为数组)。

### 4. 变量解析 (Variable Resolution)

支持 `{{nodeLabel.field}}` 格式的变量引用，解析优先级：
1. 先按节点 ID 查找
2. 再按节点标签 (Label) 查找
3. 支持嵌套路径访问 (如 `nodeLabel.files[0].url`)

## 输出格式 (Output Format)

```typescript
{
  "query": string,           // 实际执行的检索词
  "documents": string[],     // 检索到的文档片段列表 (或 LLM 回答)
  "citations": any[],        // 引用来源信息
  "documentCount": number,   // 结果数量
  "mode": "fileSearch" | "multimodal" // 执行使用的模式
}
```

> [!TIP]
> 如果 Gemini API Key 未配置 (`NEXT_PUBLIC_GEMINI_API_KEY`)，节点会返回错误提示。
