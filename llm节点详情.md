# LLM 节点 (大语言模型节点)

## 功能描述

调用大语言模型生成文本内容。该节点是工作流的核心智能单元，支持**变量引用**、**对话记忆**，以及基于下游配置的智能**流式输出**。

## 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|-----|-------|------|
| `label` | string | ✅ | - | 节点显示名称 |
| `model` | string | ❌ | 环境变量配置 | 模型选择 (从 `DEFAULT_LLM_MODEL` 或 `NEXT_PUBLIC_DEFAULT_LLM_MODEL` 读取，默认 `deepseek-ai/DeepSeek-V3.2`) |
| `systemPrompt` | string | ❌ | `""` | 系统提示词，支持 `{{variable}}` 语法 |
| `temperature` | number | ❌ | `0.7` | 生成温度 (0.0-1.0)，控制随机性 |
| `enableMemory` | boolean | ❌ | `false` | 是否启用多轮对话记忆 |
| `memoryMaxTurns` | number | ❌ | `10` | 最大记忆轮数 (1-20) |
| `customOutputs` | array | ❌ | `[]` | 用户自定义输出变量列表 `{name, value}` |

> [!TIP]
> **Temperature 指南**:
> - **0.0 - 0.3**: 确定性输出 (翻译、摘要、指令遵循)
> - **0.4 - 0.7**: 平衡 (通用对话、解答)
> - **0.8 - 1.0**: 创造性 (故事创作、头脑风暴)

## 核心执行逻辑 (Execution Logic)

### 1. 额度检查 (Quota Check)

*   LLM 节点执行前会检查用户的 `llm_executions` 配额。
*   如果用户未登录或额度用尽，将返回错误信息。
*   调试模式 (mock 数据) 不消耗额度。

### 2. 变量解析 (Variable Resolution)

*   **System Prompt**: 支持使用 `{{variable_name}}` 或 `{{node_name.key}}` 引用上游变量。
*   执行时，系统会自动收集直接上游 context 和全局 flowContext 中所有节点的输出作为上下文变量进行替换。
*   同时支持用户自定义输出变量 (`customOutputs`)。

### 3. 输入解析 (Input Resolution)

LLM 节点需要一个主要的用户输入内容 (`input`)，其解析优先级如下：

1.  **调试 mock 数据**: 如果处于调试模式且提供了 mock 数据，优先使用第一个 mock 值。
2.  **上游 `user_input`**: 自动遍历上游节点（忽略下划线开头的系统节点），查找第一个包含 `user_input` 字段且不为空的输出对象。
    *   *这通常由 `Input Node` 或其他处理节点提供。*

### 4. 流式输出机制 (Streaming Strategy)

LLM 节点是否启用流式输出，**严格取决于下游 `Output Node` 的配置**。系统会自动分析图结构来决定流式策略：

| 下游 Output 模式 | 是否流式 (`shouldStream`) | 流式模式 (`streamMode`) | 行为描述 |
|-----------------|--------------------------|------------------------|----------|
| **Direct** (直接) | ✅ 是 | `single` | 只有当本节点是 Output 配置的**第一个来源**时，才启用流式。 |
| **Select** (选择) | ✅ 是 | `select` | **首字锁定机制**：多个并行 LLM 竞速，第一个输出字符的节点"锁定"输出通道，其余被忽略。 |
| **Merge** (合并) | ✅ 是 | `segmented` | **分段流式**：输出结果流式追加到 Output 显示区的对应段落中。 |
| **Template** (模板)| ❌ 否 | - | 需要等待完整结果以进行模板渲染，不流式。 |
| **无 Output 节点** | ❌ 否 | - | 纯后台执行，不流式。 |

### 5. 对话记忆 (Memory)

*   **启用条件**: `enableMemory` 为 `true` 且存在有效的 `flowId` 和 `sessionId`。
*   **记忆键 (Memory Key)**:
    *   **流式节点** (`shouldStream = true`): 使用共享键 `"__main__"`。这通常意味着它是与用户直接交互的主节点。
    *   **非流式节点**: 使用各自的 `node.id`。这意味着中间步骤的 LLM 拥有独立的记忆空间，不污染主对话。
*   **存储**: 自动保存 `user` (输入) 和 `assistant` (输出) 的对话记录，并根据 `memoryMaxTurns` 自动裁剪旧记录。

## 输出格式 (Output Format)

```typescript
{
  "response": string  // LLM 生成的完整文本内容
}
```

> [!NOTE]
> 成功执行后会自动扣除用户的 LLM 执行次数额度，并刷新前端 QuotaStore 状态。
