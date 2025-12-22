## 4️⃣ Output 节点(输出节点)

### 功能描述
工作流的**最终出口**,如果不连接 Output 节点,工作流执行完成后可能无法在前端正确显示结果。
Output 节点负责收集上游节点的执行结果,并根据配置的**输出模式**(direct/select/merge/template)对内容进行处理,最终将**文本**回复和**附件**文件返回给用户。

**核心特性**:
- 🔄 **智能变量收集**: 自动从直接上游节点收集输出变量,避免多 LLM 场景下的变量冲突
- 🎯 **多前缀支持**: 支持 `{{变量名}}`、`{{节点名.字段}}` 和 `{{节点ID.字段}}` 三种引用方式
- 📦 **类型保留**: 内部保留原始变量类型(如文件数组),仅在文本输出时转换为字符串
- ⚡ **流式输出协调**: 根据输出模式自动决定上游 LLM 节点的流式策略

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
```

> [!TIP]
> **变量引用语法**:
> - 单字段引用: `{{response}}` - 直接引用上游节点的 response 字段
> - 节点名称前缀: `{{LLM处理.response}}` - 通过节点 label 引用(推荐,可读性高)
> - 节点 ID 前缀: `{{llm-abc123.response}}` - 通过节点 ID 引用(精确匹配)
> - 系统会自动收集所有直接上游节点的输出,并生成带前缀的变量供引用

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

**流式模式详解**:

#### 1. Single 模式 (direct)
```typescript
// LLMNodeExecutor.ts 中的实现
case 'direct':
  // 只有第一个配置的 source 启用流式
  const firstSourceId = configuredSourceIds[0];
  if (nodeId === firstSourceId) {
    return { shouldStream: true, streamMode: 'single', outputNodeId: outputNode.id };
  }
  return noStream;
```

#### 2. Select 模式 (select) - 首字锁定机制
```typescript
// streamingActions.ts 中的实现
tryLockSource: (sourceId: string): boolean => {
  const state = get();
  
  // 已锁定到其他源,拒绝
  if (state.lockedSourceId && state.lockedSourceId !== sourceId) {
    return false;
  }
  
  // 检查是否在允许列表中
  const selectSourceIds = state.selectSourceIds || [];
  if (selectSourceIds.length > 0 && !selectSourceIds.includes(sourceId)) {
    return false;
  }
  
  // 锁定到此源
  if (!state.lockedSourceId) {
    set({ lockedSourceId: sourceId });
  }
  
  return true;
}
```

**工作流程**:
1. 执行开始时调用 `initSelectStreaming(sourceIds)` 初始化候选源列表
2. 多个 LLM 并行执行,当任一节点产生第一个字符时调用 `tryLockSource(nodeId)`
3. 第一个调用成功的节点获得锁,后续字符通过 `appendStreamingText` 追加
4. 其他节点的 `tryLockSource` 返回 false,输出被忽略

#### 3. Segmented 模式 (merge) - 分段流式
```typescript
// streamingActions.ts 中的实现
initSegmentedStreaming: (sourceIds: string[]) => {
  set({
    streamingMode: 'segmented',
    streamingSegments: sourceIds.map((id, index) => ({
      sourceId: id,
      content: '',
      status: index === 0 ? 'streaming' : 'waiting',
    })),
    streamingText: '',
    isStreaming: true,
  });
}

appendToSegment: (sourceId: string, chunk: string) => {
  const segments = state.streamingSegments || [];
  const segmentIndex = segments.findIndex(s => s.sourceId === sourceId);
  
  if (segmentIndex === -1 || segments[segmentIndex].status !== 'streaming') {
    return state;
  }
  
  const updatedSegments = [...segments];
  updatedSegments[segmentIndex] = {
    ...updatedSegments[segmentIndex],
    content: updatedSegments[segmentIndex].content + chunk,
  };
  
  // 合并所有段落为最终文本(双换行分隔)
  const combinedText = updatedSegments
    .map(s => s.content)
    .filter(c => c)
    .join('\n\n');
  
  return {
    streamingSegments: updatedSegments,
    streamingText: combinedText,
  };
}

completeSegment: (sourceId: string) => {
  // 标记当前段落完成,激活下一个 waiting 段落
  const nextWaiting = updatedSegments.findIndex(s => s.status === 'waiting');
  if (nextWaiting !== -1) {
    updatedSegments[nextWaiting].status = 'streaming';
  }
}
```

**工作流程**:
1. 执行开始时调用 `initSegmentedStreaming(sourceIds)` 创建段落列表
2. 第一个段落状态为 'streaming',其余为 'waiting'
3. 当前段落的节点执行时,字符通过 `appendToSegment` 追加到对应段落
4. 节点完成时调用 `completeSegment`,激活下一个段落
5. 所有段落内容通过双换行 `\n\n` 合并为最终 `streamingText`

### 附件配置 (Attachments)

Output 节点支持返回文件附件(如生成的文档、图表等)。
在配置面板底部的"附件 (可选)"区域添加来源。

**支持类型**:
- **文件数组**: 如 `{{用户输入.files}}` (透传用户上传的文件)
- **单文件对象**: 如 `{{代码执行.generatedFile}}` (返回代码生成的单个文件)

**实现逻辑**:
```typescript
function resolveAttachments(
  attachments: AttachmentSource[] | undefined,
  variables: Record<string, unknown>
): { name: string; url: string; type?: string }[] {
  if (!attachments || attachments.length === 0) return [];

  const result: { name: string; url: string; type?: string }[] = [];

  for (const attachment of attachments) {
    if (attachment.type === 'static') {
      // 静态附件(URL) - 暂不支持,预留
      continue;
    }

    // 解析变量引用,提取变量名
    const varMatch = attachment.value.match(/\{\{(.+?)\}\}/);
    if (!varMatch) continue;

    const varName = varMatch[1];
    const value = variables[varName];

    // 处理文件数组 (如 {{用户输入.files}})
    if (Array.isArray(value)) {
      for (const file of value) {
        if (typeof file === 'object' && file !== null && 'name' in file) {
          result.push({
            name: file.name,
            url: file.url || '',
            type: file.type
          });
        }
      }
    }
    // 处理单个文件对象 (如 {{代码执行.generatedFile}})
    else if (typeof value === 'object' && value !== null && 'name' in value && 'url' in value) {
      result.push({
        name: value.name,
        url: value.url,
        type: value.type
      });
    }
  }

  return result;
}
```

### 配置示例

#### 1. 简单透传 LLM 回复
- **模式**: `direct`
- **来源 1**: `{{LLM处理.response}}`

#### 2. 分支兜底输出
- **模式**: `select`
- **来源 1**: `{{分支A.result}}` (如果分支A执行了)
- **来源 2**: `{{分支B.result}}` (如果分支B执行了)
- **来源 3**: `{{默认回复.text}}` (兜底)

#### 3. 多 LLM 内容合并
- **模式**: `merge`
- **来源 1**: `{{分析师.response}}`
- **来源 2**: `{{总结者.response}}`
- **来源 3**: `{{建议者.response}}`
- **输出效果**:
  ```
  [分析师的完整回复]

  [总结者的完整回复]

  [建议者的完整回复]
  ```

#### 4. 生成带图表的分析报告
- **模式**: `template`
- **模板内容**:
  ```markdown
  ## 数据分析报告
  
  {{LLM分析.summary}}
  
  ### 关键指标
  {{代码计算.metrics}}
  ```
- **附件来源**:
  - `{{代码绘图.generatedFile}}` (生成的图表图片)

### 变量收集机制

Output 节点通过 `collectDirectUpstreamVariables` 函数收集变量:

```typescript
function collectDirectUpstreamVariables(
  context: FlowContext,
  allNodes: AppNode[]
): Record<string, unknown> {
  const variables: Record<string, unknown> = {};
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  for (const [nodeId, nodeOutput] of Object.entries(context)) {
    if (nodeId.startsWith('_')) continue; // 跳过内部字段

    const node = nodeMap.get(nodeId);
    const nodeLabel = node?.data?.label;

    if (typeof nodeOutput === 'object' && nodeOutput !== null) {
      const record = nodeOutput as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (key.startsWith('_')) continue; // 跳过内部字段

        // 保留原始值类型(支持 files 数组等)
        variables[key] = value;

        // 带节点 label 前缀
        if (nodeLabel) {
          variables[`${nodeLabel}.${key}`] = value;
        }

        // 带节点 ID 前缀
        variables[`${nodeId}.${key}`] = value;
      }
    }
  }

  return variables;
}
```

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

### 技术实现细节

#### 执行流程

```typescript
export class OutputNodeExecutor extends BaseNodeExecutor {
  async execute(node: AppNode, context: FlowContext): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      const nodeData = node.data as OutputNodeData;
      const inputMappings = nodeData?.inputMappings;

      // 1. 获取所有节点信息
      const { nodes: allNodes } = useFlowStore.getState();

      // 2. 收集变量(保留原始类型)
      const variables = collectDirectUpstreamVariables(context, allNodes);

      // 3. 转换为字符串版本(用于模板替换)
      const stringVariables: Record<string, string> = {};
      for (const [key, value] of Object.entries(variables)) {
        stringVariables[key] = valueToString(value);
      }

      // 4. 获取模式配置
      const mode = inputMappings?.mode || 'direct';
      const sources = inputMappings?.sources || [];
      const template = inputMappings?.template || '';

      let text = "";

      // 5. 根据模式处理内容
      switch (mode) {
        case 'direct':
          if (sources.length === 0) {
            throw new Error('Output 节点配置错误:direct 模式需要至少配置一个来源 (sources)');
          }
          text = resolveSource(sources[0], variables, stringVariables);
          break;

        case 'select':
          if (sources.length === 0) {
            throw new Error('Output 节点配置错误:select 模式需要至少配置一个来源 (sources)');
          }
          for (const source of sources) {
            const resolved = resolveSource(source, variables, stringVariables);
            if (resolved && resolved.trim() && !resolved.includes('{{')) {
              text = resolved;
              break;
            }
          }
          break;

        case 'merge':
          if (sources.length === 0) {
            throw new Error('Output 节点配置错误:merge 模式需要至少配置一个来源 (sources)');
          }
          const parts: string[] = [];
          for (const source of sources) {
            const resolved = resolveSource(source, variables, stringVariables);
            if (resolved && resolved.trim() && !resolved.includes('{{')) {
              parts.push(resolved);
            }
          }
          text = parts.join('\n\n');
          break;

        case 'template':
          if (!template) {
            throw new Error('Output 节点配置错误:template 模式需要配置模板内容 (template)');
          }
          text = replaceVariables(template, stringVariables, false);
          break;

        default:
          throw new Error(`Output 节点配置错误:未知的输出模式 "${mode}"`);
      }

      // 6. 处理附件
      const attachments = resolveAttachments(inputMappings?.attachments, variables);

      // 7. 构建输出
      const output: { text: string; attachments?: { name: string; url: string; type?: string }[] } = { text };
      if (attachments.length > 0) {
        output.attachments = attachments;
      }

      return output;
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
```

#### 辅助函数

**valueToString** - 将任意类型转换为字符串:
```typescript
function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
```

**resolveSource** - 解析单个 source 的值:
```typescript
function resolveSource(
  source: ContentSource,
  variables: Record<string, unknown>,
  stringVariables: Record<string, string>
): string {
  if (source.type === 'static') {
    return source.value;
  }
  // variable 类型:解析 {{变量名}} 语法
  return replaceVariables(source.value, stringVariables, false);
}
```

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
A: 附件 URL 由上游节点(如 Input、Tool)负责生成。Output 节点仅负责收集和透传,不处理文件上传或 URL 生成逻辑。

### 性能优化

**节点查找优化**:
```typescript
// 使用 Map 优化节点查找性能 (O(1) vs O(n))
const nodeMap = new Map(allNodes.map(n => [n.id, n]));
```

**变量过滤**:
```typescript
// 跳过内部字段(以 _ 开头)
if (nodeId.startsWith('_')) continue;
if (key.startsWith('_')) continue;
```

### 错误处理

**配置错误**:
- direct 模式缺少 source → 抛出错误
- select 模式缺少 source → 抛出错误
- merge 模式缺少 source → 抛出错误
- template 模式缺少 template → 抛出错误
- 未知模式 → 抛出错误

**流式输出错误**:
```typescript
// LLMNodeExecutor 中的错误处理
catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  
  if (shouldStream) {
    if (streamMode === 'segmented') {
      // merge 模式失败:标记所有段落为失败(全部失败策略)
      storeState.failSegment(node.id, errorMessage);
    } else {
      storeState.clearStreaming();
    }
  }
  return { error: errorMessage };
}
```

### 相关文件

**核心实现**:
- `src/store/executors/OutputNodeExecutor.ts` - 执行器主逻辑
- `src/store/executors/LLMNodeExecutor.ts` - 流式配置检测 (`getStreamingConfig`)

**类型定义**:
- `src/types/flow.ts` - OutputNodeData, OutputMode, ContentSource, AttachmentSource

**UI 配置**:
- `src/components/builder/context-hud/OutputNodeConfig.tsx` - 节点配置面板
- `src/components/builder/node-forms/OutputNodeForm.tsx` - 节点表单

**流式管理**:
- `src/store/actions/streamingActions.ts` - 流式状态管理
- `src/store/actions/executionActions.ts` - 流式初始化逻辑

**工具函数**:
- `src/lib/promptParser.ts` - 变量替换 (`replaceVariables`)
- `src/store/utils/sourceResolver.ts` - 源节点解析 (`resolveSourceNodeId`)
