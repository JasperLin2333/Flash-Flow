# LLM提供商配置

<cite>
**本文档中引用的文件**   
- [llmProvider.ts](file://src/lib/llmProvider.ts)
- [llmModelsAPI.ts](file://src/services/llmModelsAPI.ts)
- [run-node/route.ts](file://src/app/api/run-node/route.ts)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts)
- [LLMNodeForm.tsx](file://src/components/builder/node-forms/LLMNodeForm.tsx)
- [executorConfig.ts](file://src/store/constants/executorConfig.ts)
- [supabase-schema.sql](file://supabase-schema.sql)
- [geminiFileSearchAPI.ts](file://src/services/geminiFileSearchAPI.ts)
</cite>

## 更新摘要
**变更内容**   
- 更新核心配置部分，新增Google Gemini提供商的详细配置信息及模型前缀匹配规则
- 更新环境变量部分，增加Gemini API密钥相关环境变量
- 更新核心配置流程图，包含Google Gemini提供商及其前缀规则
- 更新执行流程图，体现基于模型ID前缀的动态路由机制
- 新增动态路由机制说明，详细解释`getProviderForModel`函数的匹配逻辑

## 目录
1. [简介](#简介)
2. [核心配置](#核心配置)
3. [模型管理](#模型管理)
4. [API端点](#api端点)
5. [前端集成](#前端集成)
6. [数据库结构](#数据库结构)
7. [环境变量](#环境变量)
8. [执行流程](#执行流程)

## 简介
LLM提供商配置系统是本应用的核心组件，负责管理与不同大型语言模型（LLM）提供商的集成。该系统通过统一的配置接口，实现了对多个LLM提供商的动态路由和管理，包括SiliconFlow、DashScope、OpenAI和Google Gemini等。系统设计注重灵活性和可扩展性，允许通过环境变量和数据库配置来管理模型和提供商信息。

**Section sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L1-L54)
- [llmModelsAPI.ts](file://src/services/llmModelsAPI.ts#L1-L122)

## 核心配置
核心配置主要在`llmProvider.ts`文件中定义，包含了所有支持的LLM提供商的配置信息。配置采用常量对象的形式，每个提供商都有其基础URL、API密钥获取函数以及模型ID前缀匹配规则。新增了Google Gemini提供商支持，其配置包括基础URL和API密钥获取函数，并定义了`gemini-`和`google/`作为其模型ID的前缀。

```mermaid
flowchart TD
A[LLM提供商配置] --> B[SiliconFlow]
A --> C[DashScope]
A --> D[OpenAI]
A --> E[Google Gemini]
A --> F[DeepSeek]
A --> G[Doubao]
B --> H[基础URL: https://api.siliconflow.cn/v1]
B --> I[API密钥: SILICONFLOW_API_KEY]
B --> J[前缀: deepseek-ai/, Qwen/, internlm/, THUDM/]
C --> K[基础URL: https://dashscope.aliyuncs.com/compatible-mode/v1]
C --> L[API密钥: DASHSCOPE_API_KEY]
C --> M[前缀: qwen]
D --> N[基础URL: https://api.openai.com/v1]
D --> O[API密钥: OPENAI_API_KEY]
D --> P[前缀: gpt-]
E --> Q[基础URL: https://generativelanguage.googleapis.com/v1beta/openai/]
E --> R[API密钥: GEMINI_API_KEY]
E --> S[前缀: gemini-, google/]
F --> T[基础URL: https://api.deepseek.com]
F --> U[API密钥: DEEPSEEK_API_KEY]
F --> V[前缀: deepseek-chat, deepseek-reasoner]
G --> W[基础URL: https://ark.cn-beijing.volces.com/api/v3]
G --> X[API密钥: DOUBAO_API_KEY]
G --> Y[前缀: doubao, deepseek-v3]
```

**Diagram sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L14-L44)

**Section sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L14-L44)

## 模型管理
模型管理通过`llmModelsAPI.ts`文件实现，负责从Supabase数据库中获取和管理LLM模型信息。系统使用内存缓存来提高性能，缓存有效期为5分钟。

```mermaid
flowchart TD
A[获取模型列表] --> B{缓存有效?}
B --> |是| C[返回缓存数据]
B --> |否| D[查询数据库]
D --> E{查询成功?}
E --> |是| F[更新缓存]
E --> |否| G[返回默认模型]
F --> H[返回数据库数据]
G --> H
```

**Diagram sources**
- [llmModelsAPI.ts](file://src/services/llmModelsAPI.ts#L44-L88)

**Section sources**
- [llmModelsAPI.ts](file://src/services/llmModelsAPI.ts#L44-L88)

## API端点
系统提供了两个API端点来处理LLM请求：非流式和流式。两个端点都根据模型ID动态路由到相应的提供商。

### 非流式API
非流式API端点位于`run-node/route.ts`，处理一次性完成的LLM请求。

```mermaid
sequenceDiagram
participant Client
participant API
participant Provider
Client->>API : POST /api/run-node
API->>API : 解析请求参数
API->>API : 确定提供商
API->>Provider : 创建OpenAI客户端
Provider->>API : 返回完成结果
API->>Client : 返回响应
```

**Diagram sources**
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L13-L103)

### 流式API
流式API端点位于`run-node-stream/route.ts`，处理需要流式输出的LLM请求。

```mermaid
sequenceDiagram
participant Client
participant API
participant Provider
Client->>API : POST /api/run-node-stream
API->>API : 解析请求参数
API->>API : 确定提供商
API->>Provider : 创建流式响应
Provider->>API : 流式传输数据
API->>Client : 流式传输数据
```

**Diagram sources**
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L12-L135)

**Section sources**
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L13-L103)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L12-L135)

## 前端集成
前端通过`LLMNodeForm.tsx`组件与LLM提供商配置系统集成，允许用户在构建器界面中配置LLM节点。

```mermaid
flowchart TD
A[LLM节点表单] --> B[加载模型列表]
B --> C[显示模型选择]
C --> D[配置温度参数]
D --> E[设置系统提示词]
E --> F[启用对话记忆]
```

**Diagram sources**
- [LLMNodeForm.tsx](file://src/components/builder/node-forms/LLMNodeForm.tsx#L37-L264)

**Section sources**
- [LLMNodeForm.tsx](file://src/components/builder/node-forms/LLMNodeForm.tsx#L37-L264)

## 数据库结构
LLM模型信息存储在Supabase数据库的`llm_models`表中，表结构设计合理，支持模型的动态管理。

```mermaid
erDiagram
llm_models {
string id PK
string model_id UK
string model_name
string provider
boolean is_active
integer display_order
timestamp created_at
timestamp updated_at
}
```

**Diagram sources**
- [supabase-schema.sql](file://supabase-schema.sql#L183-L192)

**Section sources**
- [supabase-schema.sql](file://supabase-schema.sql#L183-L192)

## 环境变量
系统通过环境变量来配置默认模型和提供商的API密钥，提高了配置的灵活性和安全性。

```mermaid
flowchart TD
A[环境变量] --> B[SILICONFLOW_API_KEY]
A --> C[DASHSCOPE_API_KEY]
A --> D[OPENAI_API_KEY]
A --> E[GEMINI_API_KEY]
A --> F[DEEPSEEK_API_KEY]
A --> G[DOUBAO_API_KEY]
A --> H[DEFAULT_LLM_MODEL]
A --> I[NEXT_PUBLIC_DEFAULT_LLM_MODEL]
```

**Diagram sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L16-L32)
- [executorConfig.ts](file://src/store/constants/executorConfig.ts#L11-L13)

**Section sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L16-L32)
- [executorConfig.ts](file://src/store/constants/executorConfig.ts#L11-L13)

## 执行流程
LLM节点的执行流程涉及多个组件的协同工作，从用户输入到最终响应的生成。系统通过`getProviderForModel`函数实现动态路由机制，根据模型ID的前缀自动确定对应的提供商。该函数首先尝试精确匹配配置的前缀，若未匹配则对`deepseek`关键词进行特殊回退处理，最终默认使用SiliconFlow提供商。

```mermaid
flowchart TD
A[用户输入] --> B[变量替换]
B --> C[构建消息]
C --> D[确定提供商]
D --> E[验证API密钥]
E --> F[创建客户端]
F --> G[发送请求]
G --> H[处理响应]
H --> I[返回结果]
```

**Diagram sources**
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L61-L77)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L63-L84)
- [llmProvider.ts](file://src/lib/llmProvider.ts#L52-L71)

**Section sources**
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L61-L77)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L63-L84)
- [llmProvider.ts](file://src/lib/llmProvider.ts#L52-L71)