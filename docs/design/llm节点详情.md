# LLM 节点 (大语言模型节点)

## 功能描述

调用大语言模型生成文本内容。该节点是工作流的核心智能单元，支持**变量引用**、**对话记忆**，以及基于下游配置的智能**流式输出**。

## 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 约束 | 描述 |
|-------|------|-----|-------|------|------|
| `label` | string | ✅ | - | - | 节点显示名称 |
| `model` | string | ❌ | `deepseek-ai/DeepSeek-V3.2` | 从数据库动态加载 | 模型 ID (从 `DEFAULT_LLM_MODEL` 或 `NEXT_PUBLIC_DEFAULT_LLM_MODEL` 环境变量读取) |
| `systemPrompt` | string | ❌ | `""` | - | 系统提示词，支持 `{{variable}}` 语法 |
| `temperature` | number | ❌ | `0.7` | `min: 0, max: 1, step: 0.1` | 生成温度，控制随机性 |
| `enableMemory` | boolean | ❌ | `false` | - | 是否启用多轮对话记忆 |
| `memoryMaxTurns` | number | ❌ | `10` | `min: 1, max: 20, step: 1`<br>**仅当 `enableMemory=true` 时生效** | 最大记忆轮数 |
| `responseFormat` | enum | ❌ | `"text"` | `"text" \| "json_object"` | 响应格式 |
| `inputMappings` | object | ❌ | `undefined` | 见下方结构 | 输入映射配置 |

> [!TIP]
> **Temperature 指南**:
> - **0.0 - 0.3**: 确定性输出 (翻译、摘要、指令遵循)
> - **0.4 - 0.7**: 平衡 (通用对话、解答)
> - **0.8 - 1.0**: 创造性 (故事创作、头脑风暴)

### inputMappings 结构

```typescript
inputMappings?: {
  user_input?: string;  // 用户输入变量引用，如 "{{输入.formData.用户输入}}"
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| `user_input` | string \| undefined | 指定 LLM 用户输入的来源变量。支持 `{{节点标签.字段}}` 语法。若未配置，输入为空字符串。 |

> [!IMPORTANT]
> **严格模式**: 系统不再自动遍历上游寻找输入，必须通过 `inputMappings.user_input` 显式配置输入来源。

## 完整节点 JSON 示例

```json
{
  "id": "llm_abc123",
  "type": "llm",
  "position": { "x": 400, "y": 200 },
  "data": {
    "label": "智能助手",
    "model": "deepseek-ai/DeepSeek-V3.2",
    "systemPrompt": "你是一个专业的{{role}}，请用{{style}}的语气回答用户问题。",
    "temperature": 0.7,
    "enableMemory": true,
    "memoryMaxTurns": 10,
    "responseFormat": "text",
    "inputMappings": {
      "user_input": "{{输入.user_input}}"
    }
  }
}
```

### JSON 输出模式示例

当需要 LLM 输出结构化数据时，启用 `json_object` 模式：

```json
{
  "id": "llm_json_example",
  "type": "llm",
  "position": { "x": 400, "y": 200 },
  "data": {
    "label": "数据提取器",
    "model": "deepseek-ai/DeepSeek-V3.2",
    "systemPrompt": "从用户输入中提取信息，请以 JSON 格式输出，包含 name, age, location 字段。",
    "temperature": 0.3,
    "enableMemory": false,
    "responseFormat": "json_object",
    "inputMappings": {
      "user_input": "{{输入.user_input}}"
    }
  }
}
```

> [!WARNING]
> 使用 `json_object` 模式时，必须在 `systemPrompt` 中明确说明"请以 JSON 格式输出"，否则模型可能无法正确输出 JSON。



## 核心执行逻辑 (Execution Logic)

### 执行流程概览

LLM 节点的执行遵循以下步骤顺序：

```
配额检查 → 获取流式配置 → 变量收集与替换 → 输入解析 → 对话记忆处理 → LLM 请求执行 → 流式/非流式响应处理 → 记忆保存 → 额度刷新
```

### 1. 额度检查 (Quota Check)

**前端配额检查** (LLMNodeExecutor):
*   执行前检查用户的 `llm_executions` 配额
*   如果用户未登录，返回错误: "请先登录以使用 LLM 功能"
*   如果额度用尽，返回错误: "LLM 执行次数已用完 (已用/总计)。请联系管理员增加配额。"
*   调试模式 (mock 数据) **不消耗额度**，跳过检查

**服务端配额验证** (/api/run-node-stream):
*   请求到达 API 时再次验证配额 (双重保护)
*   流式输出完成后扣除额度
*   失败时不扣除

### 2. 流式配置



**流式配置获取**: 调用 `getStreamingConfig(node.id, allNodes, allEdges)` 自动分析下游 Output 节点，决定是否流式输出以及使用何种流式模式。

### 3. 变量解析 (Variable Resolution)

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

**变量替换**: 使用 `replaceVariables(systemPrompt, allVariables)` 将 System Prompt 中的 `{{variable}}` 占位符替换为实际值。

### 4. 输入解析 (Input Resolution)

LLM 节点需要一个主要的用户输入内容 (`input`)，其解析优先级如下：

1.  **调试 mock 数据**: 如果处于调试模式且提供了 mock 数据，优先使用第一个 mock 值。
2.  **`user_input` 映射**: 必须通过节点的 `inputMappings.user_input` 配置明确指定输入来源。
    *   **Strict Mode**: 系统不再自动遍历上游寻找输入，必须显式连接或配置引用。
    *   通常配置为引用的变量，如 `{{InputNode.user_input}}`。
    *   如果未配置或配置的值为空，则输入为空字符串 `""`。

### 5. 对话记忆 (Memory)

#### 启用条件

*   `enableMemory` 为 `true`
*   存在有效的 `flowId` 和 `sessionId` (通过 `context._meta` 传递)
*   最大记忆轮数: `memoryMaxTurns` (默认 10，范围 1-20)

#### 记忆范围策略 (Memory Scope)

当前版本强制使用 **节点级独立记忆** (`node` scope)。

| 范围 | Memory Key | 说明 |
|------|-----------|------|
| **仅本节点** | `node.id` | 每个 LLM 节点维护独立的对话历史，互不干扰。 |

> [!NOTE]
> **设计变更**:
> 为了简化状态管理并避免多节点间的上下文污染，已移除 `flow` (共享) 和 `shared_group` (分组) 模式。现在每个 LLM 节点都拥有完全独立的记忆空间。


#### 记忆存储流程

1. **执行前**: 调用 `llmMemoryService.getHistory` 获取历史对话 (限制为 `maxTurns` 轮)
2. **用户输入保存**: 立即调用 `llmMemoryService.appendMessage` 保存用户输入
3. **对话历史注入**: 将历史消息数组 `conversationHistory` 注入到 API 请求的 messages 参数中
4. **执行后**: 调用 `llmMemoryService.appendMessage` 保存助手回复
5. **历史裁剪**: 调用 `llmMemoryService.trimHistory` 保留最近 `maxTurns` 轮对话

**存储格式**: 每条记录包含 `role` ('user' | 'assistant') 和 `content` (文本内容)。

### 6. LLM 请求执行与流式输出

#### API 调用

**端点**: `/api/run-node-stream` (Edge Runtime)

**请求参数**:
```typescript
{
  model: string,                        // 模型 ID (如 "deepseek-ai/DeepSeek-V3.2")
  systemPrompt: string,                 // 替换变量后的 System Prompt
  temperature: number,                  // 温度参数 (默认 0.7)
  input: string,                        // 用户输入内容
  conversationHistory?: ConversationMessage[],  // 对话历史 (启用记忆时)
  responseFormat?: 'text' | 'json_object'       // 响应格式 (可选)
}
```

**响应格式**: Server-Sent Events (SSE) 流式数据
```
data: {"content": "文本片段", "reasoning": "推理内容"}
data: {"usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}}
data: [DONE]
```

#### 流式输出机制 (Streaming Strategy)

LLM 节点是否启用流式输出，**严格取决于下游 `Output Node` 的配置**。系统调用 `getStreamingConfig` 自动分析图结构:

| 下游 Output 模式 | 是否流式 | 流式模式 | 行为描述 |
|-----------------|---------|---------|----------|
| **Direct** (直接) | ✅ 是 | `single` | 单一流式输出。只有 Output 的第一个来源节点启用流式。 |
| **Select** (选择) | ✅ 是 | `select` | **首字锁定机制**: 多个并行 LLM 竞速，第一个输出字符的节点调用 `tryLockSource` 成功后锁定输出通道，其余节点的输出被忽略。 |
| **Merge** (合并) | ❌ 否 | - | 需要等待所有来源节点完成以进行合并，禁用流式，避免内容错乱。 |
| **Template** (模板)| ❌ 否 | - | 需要等待所有来源节点完成以进行模板渲染，禁用流式。 |
| **无 Output 节点** | ❌ 否 | - | 纯后台执行，不流式。 |
| **通过 Branch 连接** | ✅ 是 | (根据 Output 模式) | `getStreamingConfig` 会检测通过 Branch 节点间接连接到 Output 的情况。 |

#### 打字机效果 (Typewriter Effect)

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

#### Reasoning 内容处理

部分模型 (如 DeepSeek) 支持输出推理过程 (`reasoning_content`):
- **流式阶段**: 累积到 `fullReasoning` 变量，同时实时调用 `appendStreamingReasoning` 更新 UI
- **最终输出**: 包含在返回结果的 `reasoning` 字段中

### 7. 错误处理与运行时约束

> [!CAUTION]
> **以下条件会导致节点执行失败**，在生成工作流时必须确保避免。

| 错误条件 | 错误信息 | 代码来源 |
|---------|---------|---------|
| 用户未登录 | `"请先登录以使用 LLM 功能"` | `LLMNodeExecutor.ts:387` |
| 配额用尽 | `"LLM 执行次数已用完 (已用/总计)。请联系管理员增加配额。"` | `LLMNodeExecutor.ts:395` |
| 配额检查失败 | `"配额检查失败，请稍后重试或联系支持"` | `LLMNodeExecutor.ts:401` |
| API 请求失败 | `"API request failed: {status}"` | `LLMNodeExecutor.ts:247` |
| 无响应体 | `"No response body"` | `LLMNodeExecutor.ts:251` |
| 用户中止执行 | `"Execution aborted by user"` | `LLMNodeExecutor.ts:364` |

**其他常见错误**:
- 提供商特定错误 (如 API key 未配置)

### 8. 配额刷新

**刷新时机**:
- 流式输出完成后，服务端已扣除额度
- 前端调用 `refreshQuota()` 刷新 UI 显示 (仅非 mock 模式)

**刷新流程**:
1. 获取当前用户 (`authService.getCurrentUser`)
2. 调用 `useQuotaStore.refreshQuota(user.id)` 刷新前端配额状态
3. 失败时静默处理 (不影响执行结果)

## 输出格式 (Output Format)

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

### 依赖服务

**认证服务** (`authService`):
- `getCurrentUser()`: 获取当前登录用户

**配额服务** (`quotaService`):
- `checkQuota(userId, "llm_executions")`: 检查配额

**记忆服务** (`llmMemoryService`):
- `getHistory(flowId, nodeId, sessionId, maxTurns)`: 获取对话历史
- `appendMessage(flowId, nodeId, sessionId, role, content)`: 追加消息
- `trimHistory(flowId, nodeId, sessionId, maxTurns)`: 裁剪历史

**状态管理** (`useFlowStore`):
- `appendStreamingText(text)`: 追加流式文本
- `appendStreamingReasoning(text)`: 追加推理内容
- `clearStreaming()`: 清空流式状态
- `resetStreamingAbort()`: 重置中止状态
- `tryLockSource(nodeId)`: 尝试锁定来源 (select 模式)

## 常见问题 (FAQ)

### Q1: 为什么我的 LLM 节点不流式输出?

检查以下条件:
1. 工作流中是否存在 Output 节点
2. LLM 节点是否连接到 Output 节点 (直接或通过 Branch)
3. Output 节点的模式是否为 Template 或 Merge (这两种模式禁用流式)
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

修改 [LLMNodeExecutor.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/store/executors/LLMNodeExecutor.ts#L283-L284) 中的延迟参数:
```typescript
const delay = chars.length > 50 ? 2 : 5;  // 调整这两个数值
```

### Q5: 支持添加新的 LLM 提供商吗?

支持。在 [llmProvider.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/lib/llmProvider.ts) 的 `PROVIDER_CONFIG` 中添加新配置:
```typescript
newProvider: {
  baseURL: "https://api.example.com",
  getApiKey: () => process.env.NEW_PROVIDER_API_KEY || "",
  prefixes: ["model-prefix-"],
}
```

### Q6: JSON 输出模式有什么限制?

- 必须在 `systemPrompt` 中明确说明需要 JSON 格式输出
- 建议同时降低 `temperature` (0.3 左右) 以获得更稳定的结构化输出
- 部分模型可能不完全支持 `json_object` 模式

---

## AI 生成指引 (LLM-Ready Metadata)

> [!NOTE]
> 以下内容专为 AI 自动生成工作流设计，提供节点的语义定位和生成建议。

### 功能语义

**生态位**: LLM 节点是工作流的**核心智能处理单元**，负责理解用户意图并生成文本响应。它通常位于 Input 节点之后、Output 节点之前，作为工作流的"大脑"。

**典型连接模式**:
```
Input → LLM → Output         // 基础对话
Input → LLM → Branch → ...   // 条件分支
Input → RAG → LLM → Output   // 知识增强
```

### 生成建议

| 场景 | 推荐配置 |
|------|---------|
| 通用对话助手 | `temperature: 0.7`, `enableMemory: true`, `memoryMaxTurns: 10` |
| 精准问答/翻译 | `temperature: 0.3`, `enableMemory: false` |
| 创意写作 | `temperature: 0.9`, `enableMemory: false` |
| 结构化数据提取 | `temperature: 0.3`, `responseFormat: "json_object"` |

### 必须配置项

生成 LLM 节点时，**务必配置 `inputMappings.user_input`** 以指定输入来源：

```json
{
  "inputMappings": {
    "user_input": "{{输入.user_input}}"
  }
}
```

> [!WARNING]
> 若未配置 `inputMappings.user_input`，LLM 将收到空输入，导致无法正常响应。