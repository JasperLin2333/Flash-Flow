# LLM节点

<cite>
**本文档引用的文件**  
- [llm节点详情.md](file://docs/design/llm节点详情.md)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts)
- [LLMNodeForm.tsx](file://src/components/builder/node-forms/LLMNodeForm.tsx)
- [llmProvider.ts](file://src/lib/llmProvider.ts)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts)
- [llmMemoryService.ts](file://src/services/llmMemoryService.ts)
- [flow.ts](file://src/types/flow.ts)
- [variableUtils.ts](file://src/store/executors/utils/variableUtils.ts)
- [NodeExecutorFactory.ts](file://src/store/executors/NodeExecutorFactory.ts)
- [promptParser.ts](file://src/lib/promptParser.ts)
- [streamingActions.ts](file://src/store/actions/streamingActions.ts)
- [flowStore.ts](file://src/store/flowStore.ts)
</cite>

## 目录
1. [功能描述](#功能描述)
2. [核心参数](#核心参数)
3. [执行逻辑](#执行逻辑)
4. [输出格式](#输出格式)
5. [技术实现细节](#技术实现细节)
6. [常见问题](#常见问题)

## 功能描述

调用大语言模型生成文本内容。该节点是工作流的核心智能单元，支持**变量引用**、**对话记忆**，以及基于下游配置的智能**流式输出**。

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L5-L6)

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

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L9-L23)
- [flow.ts](file://src/types/flow.ts#L23-L30)

## 执行逻辑

### 执行流程概览

LLM 节点的执行遵循以下步骤顺序：

```
配额检查 → 延迟等待(200ms) → 获取流式配置 → 变量收集与替换 → 输入解析 → 对话记忆处理 → LLM 请求执行 → 流式/非流式响应处理 → 记忆保存 → 额度扣除
```

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L29-L33)

### 额度检查

**前端配额检查** (LLMNodeExecutor):
*   执行前检查用户的 `llm_executions` 配额
*   如果用户未登录，返回错误: "请先登录以使用 LLM 功能"
*   如果额度用尽，返回错误: "LLM 执行次数已用完 (已用/总计)。请联系管理员增加配额。"
*   调试模式 (mock 数据) **不消耗额度**，跳过检查

**服务端配额验证** (/api/run-node-stream):
*   请求到达 API 时再次验证配额 (双重保护)
*   流式输出完成后才扣除额度 (`incrementQuotaOnServer`)
*   失败时不扣除

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L37-L46)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L332-L357)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L23-L27)

### 延迟与流式配置

**执行延迟**: 开始处理前等待 `200ms`，用于展示执行进度动画 (可通过 `LLM_EXECUTOR_CONFIG.DEFAULT_DELAY_MS` 调整)。

**流式配置获取**: 调用 `getStreamingConfig(node.id, allNodes, allEdges)` 自动分析下游 Output 节点，决定是否流式输出以及使用何种流式模式。

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L50-L52)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L145)

### 变量解析

**变量收集策略** (通过 `collectVariables` 工具函数):

1. **调试模式**: 使用 mock 数据的所有字段
2. **运行模式**: 按优先级收集变量
   - 首先从全局 `flowContext` 收集早期节点输出
   - 然后从直接上游 `context` 收集 (优先级更高，会覆盖全局变量)

**支持的变量引用格式**:

| 格式 | 示例 | 说明 |
|------|------|------|
| 字段名 | `{{formatted}}` | 直接引用字段 |
| 节点标签.字段 | `{{获取当前时间.formatted}}` | 通过节点 label 引用 |
| 节点ID.字段 | `{{tool_xxx.formatted}}` | 通过节点 ID 引用 |
| 嵌套字段 | `{{nodeLabel.data.key}}` | 支持递归展开对象 |
| 自定义输出 | `{{customVar}}` | 用户在节点配置的 customOutputs |

**变量替换**: 使用 `replaceVariables(systemPrompt, allVariables)` 将 System Prompt 中的 `{{variable}}` 占位符替换为实际值。

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L56-L73)
- [variableUtils.ts](file://src/store/executors/utils/variableUtils.ts#L55-L138)
- [promptParser.ts](file://src/lib/promptParser.ts#L50-L80)

### 输入解析

LLM 节点需要一个主要的用户输入内容 (`input`)，其解析优先级如下：

1.  **调试 mock 数据**: 如果处于调试模式且提供了 mock 数据，优先使用第一个 mock 值。
2.  **上游 `user_input` 映射**: 自动遍历上游 context（忽略下划线开头的系统字段），查找第一个包含 `user_input` 字段且不为空的输出对象。
    *   这通常由 `Input Node` 提供，或通过 `inputMappings` 配置指定。
    *   如果未找到，返回空字符串 `""`

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L77-L82)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L364-L388)

### 对话记忆

#### 启用条件

*   `enableMemory` 为 `true`
*   存在有效的 `flowId` 和 `sessionId` (通过 `context._meta` 传递)
*   最大记忆轮数: `memoryMaxTurns` (默认 10，范围 1-20)

#### 记忆键策略

| 节点类型 | Memory Key | 说明 |
|---------|-----------|------|
| **流式节点** (`shouldStream = true`) | `"__main__"` | 共享主对话记忆，适用于与用户直接交互的节点 |
| **非流式节点** | `node.id` | 独立记忆空间，中间步骤不污染主对话 |

> **设计理由**: 流式节点通常是面向用户的最终输出节点，它们共享一个对话历史可以实现连贯的多轮对话体验。而非流式节点（如工作流中间的 LLM 处理节点）使用独立的记忆空间，避免内部逻辑干扰主对话上下文。

#### 记忆存储流程

1. **执行前**: 调用 `llmMemoryService.getHistory` 获取历史对话 (限制为 `maxTurns` 轮)
2. **用户输入保存**: 立即调用 `llmMemoryService.appendMessage` 保存用户输入
3. **对话历史注入**: 将历史消息数组 `conversationHistory` 注入到 API 请求的 messages 参数中
4. **执行后**: 调用 `llmMemoryService.appendMessage` 保存助手回复
5. **历史裁剪**: 调用 `llmMemoryService.trimHistory` 保留最近 `maxTurns` 轮对话

**存储格式**: 每条记录包含 `role` ('user' | 'assistant') 和 `content` (文本内容)。

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L86-L109)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L394-L446)
- [llmMemoryService.ts](file://src/services/llmMemoryService.ts#L22-L178)

### LLM 请求执行与流式输出

#### API 调用

**端点**: `/api/run-node-stream` (Edge Runtime)

**请求参数**:
```typescript
{
  model: string,                        // 模型 ID (如 "deepseek-ai/DeepSeek-V3.2")
  systemPrompt: string,                 // 替换变量后的 System Prompt
  temperature: number,                  // 温度参数 (默认 0.7)
  input: string,                        // 用户输入内容
  conversationHistory?: ConversationMessage[]  // 对话历史 (启用记忆时)
}
```

**响应格式**: Server-Sent Events (SSE) 流式数据
```
data: {"content": "文本片段", "reasoning": "推理内容"}
data: [DONE]
```

#### 流式输出机制

LLM 节点是否启用流式输出，**严格取决于下游 `Output Node` 的配置**。系统调用 `getStreamingConfig` 自动分析图结构:

| 下游 Output 模式 | 是否流式 | 流式模式 | 行为描述 |
|-----------------|---------|---------|----------|
| **Direct** (直接) | ✅ 是 | `single` | 单一流式输出。只有 Output 的第一个来源节点启用流式。 |
| **Select** (选择) | ✅ 是 | `select` | **首字锁定机制**: 多个并行 LLM 竞速，第一个输出字符的节点调用 `tryLockSource` 成功后锁定输出通道，其余节点的输出被忽略。 |
| **Merge** (合并) | ✅ 是 | `segmented` | **分段流式**: 每个节点的输出流式追加到独立的段落 (`appendToSegment`)，完成后调用 `completeSegment`。 |
| **Template** (模板)| ❌ 否 | - | 需要等待所有来源节点完成以进行模板渲染，禁用流式。 |
| **无 Output 节点** | ❌ 否 | - | 纯后台执行，不流式。 |
| **通过 Branch 连接** | ✅ 是 | (根据 Output 模式) | `getStreamingConfig` 会检测通过 Branch 节点间接连接到 Output 的情况。 |

#### 打字机效果

**极致打字机体验**: 系统将每个 SSE chunk 拆分为单个字符逐个渲染

```typescript
const chars = Array.from(contentStr);  // 支持 Unicode (如 emoji)
for (const char of chars) {
  this.flushBuffer(char, streamMode, node.id, storeState);
  // 动态延迟：积压多时延迟缩短，避免 UI 大幅落后 API
  const delay = chars.length > 50 ? 2 : 5;  // 毫秒
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

**刷新策略** (根据 streamMode):
- `single`: 调用 `appendStreamingText(char)` 直接追加
- `select`: 先调用 `tryLockSource(nodeId)` 尝试锁定，成功后追加
- `segmented`: 调用 `appendToSegment(nodeId, char)` 追加到对应段落

#### Reasoning 内容处理

部分模型 (如 DeepSeek) 支持输出推理过程 (`reasoning_content`):
- **流式阶段**: 累积到 `fullReasoning` 变量 (暂不实时显示)
- **最终输出**: 包含在返回结果的 `reasoning` 字段中

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L115-L171)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L218-L277)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L78-L108)

### 错误处理

**流式模式下的错误**:
- `segmented` 模式: 调用 `failSegment(nodeId, errorMessage)` 标记段落失败
- 其他模式: 调用 `clearStreaming()` 清空流式状态

**常见错误信息**:
- `"API request failed: [status]"`: API 请求失败
- `"No response body"`: 响应体缺失
- 提供商特定错误 (如 API key 未配置)

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L174-L181)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L309-L319)

### 配额扣除

**扣除时机**:
- **前端**: 流式输出完成后调用 `incrementQuota()` (仅非 mock 模式)
- **后端**: SSE 流结束前调用 `incrementQuotaOnServer` (双重保险)

**扣除流程**:
1. 获取当前用户 (`authService.getCurrentUser`)
2. 调用 `quotaService.incrementUsage(user.id, "llm_executions")`
3. 刷新前端配额状态 `useQuotaStore.refreshQuota(user.id)`
4. 失败时静默处理 (不影响执行结果)

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L185-L193)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L454-L471)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L105)

## 输出格式

```typescript
{
  response: string,    // LLM 生成的完整文本内容
  reasoning?: string   // 推理内容 (仅部分模型支持，如 DeepSeek Reasoner)
}
```

**ExecutionResult 包装**:
```typescript
{
  output: {
    response: string,
    reasoning?: string,
    error?: string      // 执行失败时返回
  },
  executionTime: number  // 执行耗时(毫秒)
}
```

> [!NOTE]
> 成功执行后会自动扣除用户的 LLM 执行次数额度，并刷新前端 QuotaStore 状态。

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L197-L217)

## 技术实现细节

### 流式配置自动检测

`getStreamingConfig` 函数的检测逻辑:

1. **检查 Output 节点存在性**: 如果工作流中没有 Output 节点，返回 `shouldStream: false`
2. **查找下游 Output**:
   - 直接连接: 检查当前节点的 outgoing edges
   - 间接连接: 检查上游 Branch 节点的下游是否有 Output
3. **分析 Output 配置**:
   - 读取 `outputMode` (direct/select/merge/template)
   - 读取 `inputMappings` 判断当前节点是否为配置的来源
4. **返回配置**:
   ```typescript
   { 
     shouldStream: boolean,
     streamMode: 'single' | 'select' | 'segmented',
     outputNodeId: string | null
   }
   ```

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L223-L239)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L63-L123)

### 模型提供商路由

**支持的提供商** (配置在 `llmProvider.ts`):

| 提供商 | 模型前缀示例 | 环境变量 | Base URL |
|--------|-------------|---------|----------|
| Doubao (字节火山引擎) | `doubao-*`, `deepseek-v3` | `DOUBAO_API_KEY` 或 `VOLCENGINE_API_KEY` | `https://ark.cn-beijing.volces.com/api/v3` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` | `DEEPSEEK_API_KEY` | `https://api.deepseek.com` |
| OpenAI | `gpt-*` | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| Google | `gemini-*`, `google/*` | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| DashScope (阿里) | `qwen-*` | `DASHSCOPE_API_KEY` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| SiliconFlow (硅基流动) | `deepseek-ai/*`, `Qwen/*`, `internlm/*`, `THUDM/*` | `SILICONFLOW_API_KEY` | `https://api.siliconflow.cn/v1` |

**路由逻辑**: `getProviderForModel(model)` 根据模型 ID 前缀匹配对应的提供商配置。

> [!TIP]
> **默认提供商**：如果模型以 `deepseek` 开头但未匹配具体前缀（如 `deepseek-chat` 或 `deepseek-ai/`），则默认使用 SiliconFlow。其他未匹配模型也会回退到 SiliconFlow。

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L243-L257)
- [llmProvider.ts](file://src/lib/llmProvider.ts#L14-L71)

### 依赖服务

**认证服务** (`authService`):
- `getCurrentUser()`: 获取当前登录用户

**配额服务** (`quotaService`):
- `checkQuota(userId, "llm_executions")`: 检查配额
- `incrementUsage(userId, "llm_executions")`: 增加使用次数

**记忆服务** (`llmMemoryService`):
- `getHistory(flowId, nodeId, sessionId, maxTurns)`: 获取对话历史
- `appendMessage(flowId, nodeId, sessionId, role, content)`: 追加消息
- `trimHistory(flowId, nodeId, sessionId, maxTurns)`: 裁剪历史

**状态管理** (`useFlowStore`):
- `appendStreamingText(text)`: 追加流式文本
- `clearStreaming()`: 清空流式状态
- `resetStreamingAbort()`: 重置中止状态
- `appendToSegment(nodeId, text)`: 追加到段落
- `completeSegment(nodeId)`: 标记段落完成
- `failSegment(nodeId, error)`: 标记段落失败
- `tryLockSource(nodeId)`: 尝试锁定来源 (select 模式)

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L261-L281)
- [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L2-L6)
- [streamingActions.ts](file://src/store/actions/streamingActions.ts#L14-L31)

## 常见问题

### Q1: 为什么我的 LLM 节点不流式输出?

检查以下条件:
1. 工作流中是否存在 Output 节点
2. LLM 节点是否连接到 Output 节点 (直接或通过 Branch)
3. Output 节点的模式是否为 Template (Template 模式禁用流式)
4. 在 direct 模式下，LLM 节点是否为 Output 的第一个来源

### Q2: 记忆功能不生效?

确认:
1. 节点配置中 `enableMemory` 为 `true`
2. 执行时传递了有效的 `flowId` 和 `sessionId` (通过 `context._meta`)
3. 数据库中 `llm_memories` 表可访问
4. 检查浏览器控制台是否有记忆服务相关错误

### Q3: 变量替换不工作?

检查:
1. 变量语法是否正确: `{{variableName}}` 或 `{{nodeLabel.field}}`
2. 上游节点是否已执行并输出了对应字段
3. 节点 label 拼写是否正确 (区分大小写)
4. 使用调试模式查看 `collectVariables` 收集到的变量

### Q4: 如何调整打字机速度?

修改 [LLMNodeExecutor.ts](file://src/store/executors/LLMNodeExecutor.ts#L273-L274) 中的延迟参数:
```typescript
const delay = chars.length > 50 ? 2 : 5;  // 调整这两个数值
```

### Q5: 支持添加新的 LLM 提供商吗?

支持。在 [llmProvider.ts](file://src/lib/llmProvider.ts) 的 `PROVIDER_CONFIG` 中添加新配置:
```typescript
newProvider: {
  baseURL: "https://api.example.com",
  getApiKey: () => process.env.NEW_PROVIDER_API_KEY || "",
  prefixes: ["model-prefix-"],
}
```

**Section sources**
- [llm节点详情.md](file://docs/design/llm节点详情.md#L284-L324)