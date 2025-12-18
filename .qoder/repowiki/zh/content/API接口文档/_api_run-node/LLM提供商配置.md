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
</cite>

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
核心配置主要在`llmProvider.ts`文件中定义，包含了所有支持的LLM提供商的配置信息。配置采用常量对象的形式，每个提供商都有其基础URL和API密钥获取函数。

```mermaid
flowchart TD
A[LLM提供商配置] --> B[SiliconFlow]
A --> C[DashScope]
A --> D[OpenAI]
A --> E[Google Gemini]
B --> F[基础URL: https://api.siliconflow.cn/v1]
B --> G[API密钥: SILICONFLOW_API_KEY]
C --> H[基础URL: https://dashscope.aliyuncs.com/compatible-mode/v1]
C --> I[API密钥: DASHSCOPE_API_KEY]
D --> J[基础URL: https://api.openai.com/v1]
D --> K[API密钥: OPENAI_API_KEY]
E --> L[基础URL: https://generativelanguage.googleapis.com/v1beta/openai/]
E --> M[API密钥: NEXT_PUBLIC_GEMINI_API_KEY/GEMINI_API_KEY]
```

**Diagram sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L8-L25)

**Section sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L8-L25)

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
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L10-L74)

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
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L9-L110)

**Section sources**
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L10-L74)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L9-L110)

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
- [LLMNodeForm.tsx](file://src/components/builder/node-forms/LLMNodeForm.tsx#L46-L248)

**Section sources**
- [LLMNodeForm.tsx](file://src/components/builder/node-forms/LLMNodeForm.tsx#L46-L248)

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
A --> E[NEXT_PUBLIC_GEMINI_API_KEY]
A --> F[DEFAULT_LLM_MODEL]
A --> G[NEXT_PUBLIC_DEFAULT_LLM_MODEL]
```

**Diagram sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L11-L24)
- [executorConfig.ts](file://src/store/constants/executorConfig.ts#L11-L13)

**Section sources**
- [llmProvider.ts](file://src/lib/llmProvider.ts#L11-L24)
- [executorConfig.ts](file://src/store/constants/executorConfig.ts#L11-L13)

## 执行流程
LLM节点的执行流程涉及多个组件的协同工作，从用户输入到最终响应的生成。

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
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L10-L74)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L9-L110)

**Section sources**
- [run-node/route.ts](file://src/app/api/run-node/route.ts#L10-L74)
- [run-node-stream/route.ts](file://src/app/api/run-node-stream/route.ts#L9-L110)