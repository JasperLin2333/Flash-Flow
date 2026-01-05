# RAG 节点 (检索增强生成节点)

## 功能描述

RAG（检索增强生成）节点使用 Google Gemini API 进行智能文档检索和问答，支持两种工作模式：

1.  **静态模式 (Static Mode)**：使用 Builder 中预先上传到 File Search Store 的知识库文件。用户还可以明确选择"静态上传"模式。
2.  **变量引用模式 (Variable Mode)**：从上游节点（通常是 Input 节点）实时引用用户上传的文件。用户可以明确选择"变量引用"模式。

### 模式选择机制

系统优先使用用户在 UI上显式选择的模式：
- **变量引用模式 (`fileMode: 'variable'`)**: 强制使用动态文件引用。
- **静态上传模式 (`fileMode: 'static'`)**: 强制使用预上传的文件。
- **自动/兼容模式**: 如果未显式指定模式（旧版节点），则根据是否配置了动态文件引用自动判断。

## 核心参数

### 节点数据参数 (`RAGNodeData`)

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|-----|-------|------|
| `label` | string | ✅ | `"RAG"` | 节点显示名称 |
| `fileMode` | string | ❌ | - | 模式选择：`'static'` (静态) \| `'variable'` (变量) |
| `files` | File[] | ❌ | `[]` | 知识库文件 (槽位1) |
| `files2` | File[] | ❌ | `[]` | 知识库文件 (槽位2) |
| `files3` | File[] | ❌ | `[]` | 知识库文件 (槽位3) |
| `fileSearchStoreName` | string | ❌ | - | File Search Store 完整名称<br/>格式：`fileSearchStores/xxx`<br/>（由 API 自动创建和管理） |
| `fileSearchStoreId` | string | ❌ | - | Store 显示 ID（用户友好标识）<br/>格式：`store-{nodeId}-{timestamp}` |
| `maxTokensPerChunk` | number | ❌ | `200` | 文档分块大小（50-500 tokens）<br/>影响检索精度和性能 |
| `maxOverlapTokens` | number | ❌ | `20` | 分块重叠大小（0-100 tokens）<br/>提高跨块内容的连贯性 |
| `uploadStatus` | string | ❌ | `"idle"` | 文件上传状态<br/>`idle` \| `uploading` \| `processing` \| `completed` \| `error` |
| `uploadError` | string | ❌ | - | 上传错误信息（仅当 status 为 error 时） |
| `searchQuery` | string | ❌ | - | 最后一次执行的搜索查询（执行结果） |
| `foundDocuments` | string[] | ❌ | - | 找到的文档片段（执行结果） |

#### 输入映射参数 (`inputMappings`)

`inputMappings` 是一个可选的配置对象，用于从上游节点引用数据。支持 `{{变量}}` 模板语法。

> [!NOTE]
> `inputMappings` 是 `RAGNodeData` 的扩展字段，在类型定义中未显式声明，但在执行器中通过动态类型访问。这种设计允许灵活扩展节点配置。

| 参数名 | 类型 | 必填 | 描述 | 示例 |
|-------|------|-----|------|------|
| `query` | string | ❌ | 检索查询内容模板<br/>支持变量引用和纯文本 | `{{用户输入.user_input}}`<br/>`{{LLM.output}}` |
| `files` | string | ❌ | 动态文件引用 (槽位1) | `{{用户输入.files}}` |
| `files2` | string | ❌ | 动态文件引用 (槽位2) | `{{API.files}}` |
| `files3` | string | ❌ | 动态文件引用 (槽位3) | `{{Other.files}}` |

#### 变量解析规则

1. **优先级**：先按节点 ID 查找，再按节点标签（Label）查找
2. **支持格式**：
   - `{{nodeLabel.field}}` - 引用节点标签的字段
   - `{{nodeId.field}}` - 引用节点 ID 的字段  
   - `{{field}}` - 直接字段名（从上下文自动查找）
3. **嵌套路径**：支持 `{{node.formData.destination}}` 等嵌套访问
4. **数组访问**：支持 `{{node.files[0].url}}` 等索引访问

#### 查询内容解析逻辑

- **优先使用** `inputMappings.query` 模板解析
- **降级处理**：如果未配置，尝试从上游上下文自动提取文本内容
- **调试模式**：使用 `mockData.query` 覆盖（通过调试对话框传入）

> [!NOTE]
> **支持的文件格式**:  
> - 文档: `.pdf`, `.txt`, `.md`, `.doc`, `.docx`  
> - 图片: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`（仅动态模式）
>
> **文件大小限制**: 单个文件最大 100MB  
> **静态模式**: 需要在 Builder 中预先上传文件到 File Search Store  
> **动态模式**: 文件必须包含可访问的 `url` 字段

## 核心执行逻辑 (Execution Logic)

### 执行流程概览

```
开始执行
  ↓
解析 inputMappings
  ↓
解析查询内容（query）
  ↓
收集所有动态文件 (files, files2, files3)
  ↓
判断执行模式 (ragData.fileMode)
  ├─ 'variable' (变量模式)
  │    └─ 检查是否有有效动态文件
  │         ├─ 是 → **动态模式** (Multimodal API)
  │         └─ 否 → 报错
  │
  ├─ 'static' (静态模式)
  │    └─ **静态模式** (File Search Store)
  │
  └─ undefined (兼容模式)
       └─ 是否有有效动态文件?
            ├─ 是 → **动态模式**
            └─ 否 → **静态模式**
```

### 1. 模式选择逻辑

```typescript
// RAGNodeExecutor.ts - execute logic

// 1. 收集所有动态文件
let allDynamicFiles = [];
['files', 'files2', 'files3'].forEach(key => {
    // 解析 inputMappings[key] 并添加到 allDynamicFiles
});

// 2. 根据 fileMode 决定策略
const fileMode = ragData.fileMode;

if (fileMode === 'variable') {
    // 显式变量模式：必须有动态文件
    return executeWithMultimodal(query, allDynamicFiles);
} else if (fileMode === 'static') {
    // 显式静态模式：忽略动态文件，使用 Store
    return executeWithFileSearch(query, ragData);
} else {
    // 自动判断 (Fallback)
    if (allDynamicFiles.length > 0) {
        return executeWithMultimodal(query, allDynamicFiles);
    } else {
        return executeWithFileSearch(query, ragData);
    }
}
```

**关键点**：
- 支持 `files`, `files2`, `files3` 三个动态文件来源，执行时会自动合并。
- 显式 `fileMode` 优先级最高。

### 2. 查询内容解析

**解析优先级**（从高到低）：

1. **调试模式** (`mockData.query`)  
   ```typescript
   if (mockData && typeof mockData.query === 'string' && mockData.query.trim()) {
       query = mockData.query;
   }
   ```

2. **模板解析** (`inputMappings.query`)  
   ```typescript
   return queryTemplate.replace(/\{\{([^}]+)\}\}/g, (_match, varPath) => {
       const value = resolveVariableTemplate(`{{${varPath}}}`, context);
       return String(value ?? '');
   });
   ```

3. **自动提取** (`extractInputFromContext`)  
   从上游上下文中自动查找文本内容

### 3. 动态文件解析

**支持的文件变量格式**：

```typescript
// 文件数组
{{InputNode.files}}  // [{ name, url, type }, ...]

// 单文件对象（自动包装为数组）
{{InputNode.file}}   // { name, url, type }
```

**过滤规则**：
- 必须是对象或对象数组
- 每个对象必须包含非空的 `url` 字段
- 提取 `name`, `url`, `type` 字段

**实现代码**：
```typescript
const validFiles = filesValue
    .filter((f) => typeof f === 'object' && f !== null && 
                   typeof f.url === 'string' && f.url.trim() !== '')
    .map((f) => ({
        name: String(f.name || 'unknown'),
        url: String(f.url),
        type: f.type ? String(f.type) : undefined
    }));
```

### 4. 变量模板解析机制

**解析函数**：`resolveVariableTemplate(template, context)`

**查找顺序**：

1. **按节点 ID 直接查找**  
   ```typescript
   if (context[nodeRef]) {
       return getNestedValue(context[nodeRef], fieldParts.join('.'));
   }
   ```

2. **按节点标签（Label）查找**  
   ```typescript
   const meta = context._meta?.nodeLabels;  // { nodeId: label }
   const nodeId = Object.entries(meta).find(([, label]) => label === nodeRef)?.[0];
   ```

3. **直接字段名匹配**  
   遍历上下文中所有节点输出，查找匹配的字段

**嵌套路径支持**：
```typescript
// 支持点号和方括号
"field.subfield"      → obj.field.subfield
"files[0].url"       → obj.files[0].url
"formData.destination" → obj.formData.destination
```

## 输出格式 (Output Format)

### 成功执行时的输出

```typescript
{
  query: string;              // 实际执行的检索查询内容
  documents: string[];        // 检索到的文档片段数组或 AI 生成的回答
  citations?: Array<{         // 引用来源信息（可选）
    source: string;           // 来源文件名或标题
    chunk: string;            // 引用的文本片段
  }>;
  documentCount: number;      // 返回的文档数量
  mode: 'fileSearch' | 'multimodal';  // 实际使用的执行模式
}
```

### 错误时的输出

```typescript
{
  error: string;  // 错误描述信息
}
```

### 不同模式的输出差异

#### 静态模式 (fileSearch)

```typescript
{
  query: "什么是 RAG？",
  documents: [
    "RAG (检索增强生成) 是一种结合检索和生成的 AI 技术...",
    "通过检索相关文档片段，RAG 可以提供更准确的回答..."
  ],
  citations: [
    { source: "AI技术手册.pdf", chunk: "RAG (检索增强生成)..." },
    { source: "AI技术手册.pdf", chunk: "通过检索相关文档..." }
  ],
  documentCount: 2,
  mode: "fileSearch"
}
```

#### 动态模式 (multimodal)

```typescript
{
  query: "总结这份文档的主要内容",
  documents: [
    "该文档主要介绍了...[AI 生成的完整回答]"
  ],
  citations: [
    { source: "用户文档.pdf", chunk: "" }
  ],
  documentCount: 1,
  mode: "multimodal"
}
```

### 输出字段说明

| 字段 | 类型 | 必有 | 描述 |
|-----|------|-----|------|
| `query` | string | ✅ | 实际执行的查询内容（解析后的） |
| `documents` | string[] | ✅ | 文档片段数组或 AI 回答 |
| `citations` | object[] | ❌ | 引用来源（fileSearch 模式更详细） |
| `documentCount` | number | ✅ | 返回的文档数量 |
| `mode` | string | ✅ | 执行模式标识 |
| `error` | string | ❌ | 错误信息（仅失败时存在） |

## 服务端 API

RAG 功能通过后端 API 路由实现，所有 API 调用都在服务端进行，**API Key 不会暴露到客户端**。

### API 路由总览

| 路由 | 方法 | Runtime | 功能 | 认证 |
|------|------|---------|------|------|
| `/api/rag/search` | POST | Edge | 执行 RAG 检索（支持双模式） | ✅ |
| `/api/rag/store` | POST | Edge | 创建 FileSearchStore | ✅ |
| `/api/rag/upload` | POST | Node.js | 上传文件到 Store | ✅ |

> [!IMPORTANT]
> - 所有 API 都需要用户身份认证（通过 `getAuthenticatedUser` 检查）
> - 需要配置环境变量 `GEMINI_API_KEY`，否则返回 500 错误
> - `/api/rag/upload` 使用 Node.js runtime 以支持大文件处理

---

### 1. `/api/rag/search` - RAG 检索 API

#### 请求格式

**静态模式**（File Search）：
```typescript
POST /api/rag/search
Content-Type: application/json

{
  mode: "fileSearch",
  query: string,
  fileSearchStoreName: string  // 如 "fileSearchStores/abc123"
}
```

**动态模式**（Multimodal）：
```typescript
POST /api/rag/search
Content-Type: application/json

{
  mode: "multimodal",
  query: string,
  files: Array<{
    name: string,
    url: string,
    type?: string
  }>
}
```

#### 响应格式

```typescript
// 成功
{
  documents: string[],
  citations?: Array<{
    source: string,
    chunk: string
  }>
}

// 失败
{
  error: string
}
```

#### 实现细节

**静态模式执行**：
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: query,
  config: {
    tools: [{
      fileSearch: {
        fileSearchStoreNames: [fileSearchStoreName]
      }
    }]
  }
});
```

**动态模式执行**：
1. 从文件 URL 获取文件内容
2. 转换为 Base64 编码
3. 构建多模态请求
```typescript
const parts = [
  { inlineData: { mimeType, data: base64Data } },  // 每个文件
  { text: query }  // 查询文本
];

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts }]
});
```

---

### 2. `/api/rag/store` - 创建 Store API

#### 请求格式

```typescript
POST /api/rag/store
Content-Type: application/json

{
  displayName: string  // Store 的显示名称
}
```

#### 响应格式

```typescript
{
  name: string,          // 完整名称 "fileSearchStores/xxx"
  displayName: string,   // 显示名称
  createTime: string     // ISO 时间戳
}
```

#### 实现细节

```typescript
const fileSearchStore = await ai.fileSearchStores.create({
  config: { displayName }
});
```

**自动创建时机**：
- RAGNodeForm 组件挂载时
- 如果 `fileSearchStoreName` 为空
- 自动生成 displayName：`store-{nodeId前8位}-{timestamp}`

---

### 3. `/api/rag/upload` - 文件上传 API

#### 请求格式

```typescript
POST /api/rag/upload
Content-Type: multipart/form-data

{
  file: File,                    // 文件对象
  fileSearchStoreName: string,   // Store 名称
  displayName?: string,          // 显示名称（默认文件名）
  maxTokensPerChunk?: number,    // 分块大小（默认 200）
  maxOverlapTokens?: number      // 重叠大小（默认 20）
}
```

#### 响应格式

```typescript
{
  name: string,         // 文件资源名称
  displayName: string,  // 显示名称
  sizeBytes: number     // 文件大小（字节）
}
```

#### 分块配置

| 参数 | 默认值 | 范围 | 说明 |
|-----|--------|------|------|
| `maxTokensPerChunk` | 200 | 50-500 | 影响检索精度，越小越精确但检索范围越窄 |
| `maxOverlapTokens` | 20 | 0-100 | 提高跨块内容连贯性，避免重要信息被截断 |

#### 上传流程

1. **验证文件大小**（< 100MB）
2. **创建分块配置**
   ```typescript
   chunkingConfig: {
     strategy: 'staticChunking',
     staticChunkingConfig: {
       maxTokensPerChunk,
       maxOverlapTokens
     }
   }
   ```
3. **上传到 Gemini**
   ```typescript
   const uploadedFile = await ai.files.upload({
     file: fileBuffer,
     config: {
       displayName,
       mimeType: file.type
     }
   });
   ```
4. **添加到 Store**
   ```typescript
   await ai.fileSearchStores.addFile({
     fileSearchStoreName,
     file: uploadedFile.name,
     chunkingConfig
   });
   ```

---

### API 错误处理

| 错误类型 | HTTP 状态码 | 错误信息 |
|---------|-----------|----------|
| 未认证 | 401 | "Unauthorized" |
| API Key 未配置 | 500 | "Gemini API Key 未配置" |
| 查询为空 | 400 | "查询内容不能为空" |
| Store 未指定 | 400 | "未指定 FileSearchStore" |
| 文件为空 | 400 | "未提供文件" |
| 无效模式 | 400 | "无效的搜索模式" |
| 文件过大 | 400 | "文件大小超过 100MB" |
| 其他错误 | 500 | 具体错误消息 |

---

### 环境变量配置

```bash
# .env.local
GEMINI_API_KEY=your_api_key_here
```

> [!WARNING]
> - `GEMINI_API_KEY` 必须在服务端环境变量中配置
> - 不要使用 `NEXT_PUBLIC_` 前缀（会暴露到客户端）
> - API Key 检查在每个请求中进行，未配置时立即返回错误
