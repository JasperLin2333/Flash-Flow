# Supabase集成与配置

<cite>
**本文档引用的文件**
- [supabase.ts](file://src/lib/supabase.ts)
- [database.ts](file://src/types/database.ts)
- [flowAPI.ts](file://src/services/flowAPI.ts)
- [chatHistoryAPI.ts](file://src/services/chatHistoryAPI.ts)
- [health/route.ts](file://src/app/api/health/route.ts)
- [flowStore.ts](file://src/store/flowStore.ts)
- [package.json](file://package.json)
</cite>

## 目录
1. [简介](#简介)
2. [Supabase客户端初始化](#supabase客户端初始化)
3. [环境变量配置](#环境变量配置)
4. [类型安全实现](#类型安全实现)
5. [数据表结构设计](#数据表结构设计)
6. [行级安全策略](#行级安全策略)
7. [服务端API交互机制](#服务端api交互机制)
8. [连接管理与错误处理](#连接管理与错误处理)
9. [安全考虑事项](#安全考虑事项)

## 简介
本架构文档系统描述了Flash Flow SaaS应用如何通过Supabase实现数据持久化和实时同步。文档详细说明了supabase客户端的初始化过程、环境变量配置要求和类型安全实现方案，解释了客户端在浏览器环境中的使用模式以及与服务端API的安全交互机制。文档还阐述了身份验证、数据表结构设计、行级安全策略的应用，并提供了连接管理、错误处理、重试机制和性能监控的最佳实践。

## Supabase客户端初始化

Supabase客户端的初始化在`src/lib/supabase.ts`文件中完成，采用单例模式创建客户端实例，确保在整个应用中共享同一个连接。

```mermaid
classDiagram
class SupabaseClient {
+url : string
+anonKey : string
+createClient() : SupabaseClient
+getSupabaseClient() : SupabaseClient
}
SupabaseClient --> Database : "类型绑定"
Database --> flows : "数据表"
Database --> chat_history : "数据表"
```

**图表来源**
- [supabase.ts](file://src/lib/supabase.ts#L1-L17)
- [database.ts](file://src/types/database.ts#L1-L58)

**本节来源**
- [supabase.ts](file://src/lib/supabase.ts#L1-L17)

## 环境变量配置

Supabase集成需要配置关键的环境变量，这些变量在应用启动时被读取并用于初始化客户端。

```mermaid
flowchart TD
Start([应用启动]) --> LoadEnv["加载环境变量"]
LoadEnv --> CheckEnv["验证环境变量"]
CheckEnv --> |缺失| ThrowError["抛出错误: Missing Supabase environment variables"]
CheckEnv --> |完整| CreateClient["创建Supabase客户端"]
CreateClient --> ExportClient["导出客户端实例"]
ExportClient --> End([初始化完成])
```

**图表来源**
- [supabase.ts](file://src/lib/supabase.ts#L4-L8)
- [health/route.ts](file://src/app/api/health/route.ts#L5-L7)

**本节来源**
- [supabase.ts](file://src/lib/supabase.ts#L4-L8)
- [health/route.ts](file://src/app/api/health/route.ts#L5-L7)

## 类型安全实现

项目通过TypeScript类型系统实现了与Supabase数据库模式的类型安全集成，确保了数据操作的类型正确性。

```mermaid
classDiagram
class Database {
+public : Schema
}
class Schema {
+Tables : TableMap
}
class TableMap {
+flows : FlowTable
+chat_history : ChatHistoryTable
}
class FlowTable {
+Row : FlowRow
+Insert : FlowInsert
+Update : FlowUpdate
}
class FlowRow {
+id : string
+owner_id : string
+name : string
+description : string | null
+data : Json
+icon_kind : string | null
+icon_name : string | null
+icon_url : string | null
+node_count : number | null
+created_at : string
+updated_at : string
}
class FlowInsert {
+id? : string
+owner_id : string
+name : string
+description? : string | null
+data : Json
+icon_kind? : string | null
+icon_name? : string | null
+icon_url? : string | null
+node_count? : number | null
+created_at? : string
+updated_at? : string
}
class FlowUpdate {
+id? : string
+owner_id? : string
+name? : string
+description? : string | null
+data? : Json
+icon_kind? : string | null
+icon_name? : string | null
+icon_url? : string | null
+node_count? : number | null
+created_at? : string
+updated_at? : string
}
Database --> Schema
Schema --> TableMap
TableMap --> FlowTable
FlowTable --> FlowRow
FlowTable --> FlowInsert
FlowTable --> FlowUpdate
```

**图表来源**
- [database.ts](file://src/types/database.ts#L9-L58)
- [flowAPI.ts](file://src/services/flowAPI.ts#L22-L34)

**本节来源**
- [database.ts](file://src/types/database.ts#L9-L58)
- [flowAPI.ts](file://src/services/flowAPI.ts#L22-L34)

## 数据表结构设计

系统设计了两个主要的数据表：`flows`和`chat_history`，用于存储工作流数据和聊天历史记录。

```mermaid
erDiagram
FLOWS {
string id PK
string owner_id FK
string name
string description
json data
string icon_kind
string icon_name
string icon_url
number node_count
timestamp created_at
timestamp updated_at
}
CHAT_HISTORY {
string id PK
string flow_id FK
string user_message
string assistant_message
timestamp created_at
timestamp updated_at
}
FLOWS ||--o{ CHAT_HISTORY : "包含"
```

**图表来源**
- [database.ts](file://src/types/database.ts#L12-L58)
- [chatHistoryAPI.ts](file://src/services/chatHistoryAPI.ts#L4-L11)

**本节来源**
- [database.ts](file://src/types/database.ts#L12-L58)
- [chatHistoryAPI.ts](file://src/services/chatHistoryAPI.ts#L4-L11)

## 行级安全策略

系统通过行级安全策略（RLS）控制数据访问权限，确保用户只能访问自己的数据。

```mermaid
sequenceDiagram
participant Client as "客户端应用"
participant Supabase as "Supabase"
participant Policy as "RLS策略"
participant Database as "数据库"
Client->>Supabase : 请求数据操作
Supabase->>Policy : 验证用户身份
Policy->>Policy : 检查owner_id匹配
alt 用户匹配
Policy->>Database : 允许操作
Database-->>Supabase : 返回数据
Supabase-->>Client : 返回结果
else 用户不匹配
Policy-->>Supabase : 拒绝操作
Supabase-->>Client : 返回403错误
end
```

**图表来源**
- [flowAPI.ts](file://src/services/flowAPI.ts#L15-L16)
- [chatHistoryAPI.ts](file://src/services/chatHistoryAPI.ts#L18-L22)

**本节来源**
- [flowAPI.ts](file://src/services/flowAPI.ts#L15-L16)
- [chatHistoryAPI.ts](file://src/services/chatHistoryAPI.ts#L18-L22)

## 服务端API交互机制

服务端API通过Supabase客户端与数据库交互，实现了健康检查、数据操作等功能。

```mermaid
sequenceDiagram
participant Client as "客户端"
participant API as "API路由"
participant Supabase as "Supabase客户端"
participant DB as "数据库"
Client->>API : GET /api/health
API->>Supabase : 检查环境变量
API->>Supabase : 测试连接
API->>DB : 查询flows表
DB-->>API : 返回结果
API-->>Client : 返回健康状态
Client->>API : POST /api/flow操作
API->>Supabase : 执行数据库操作
Supabase->>DB : 执行查询
DB-->>Supabase : 返回数据
Supabase-->>API : 返回结果
API-->>Client : 返回响应
```

**图表来源**
- [health/route.ts](file://src/app/api/health/route.ts#L4-L51)
- [flowAPI.ts](file://src/services/flowAPI.ts#L14-L240)

**本节来源**
- [health/route.ts](file://src/app/api/health/route.ts#L4-L51)
- [flowAPI.ts](file://src/services/flowAPI.ts#L14-L240)

## 连接管理与错误处理

系统实现了健壮的连接管理和错误处理机制，确保在各种网络条件下都能正常工作。

```mermaid
flowchart TD
Start([开始操作]) --> TryOperation["尝试数据库操作"]
TryOperation --> HasError{"发生错误?"}
HasError --> |是| CheckErrorType["检查错误类型"]
CheckErrorType --> |网络错误| SetConnected["设置connected=false"]
CheckErrorType --> |权限错误| SetAuth["设置auth_ok=false"]
CheckErrorType --> |表不存在| SetTable["设置table_ok=false"]
CheckErrorType --> |其他错误| LogError["记录错误信息"]
SetConnected --> HandleError["处理连接问题"]
SetAuth --> HandleError
SetTable --> HandleError
LogError --> HandleError
HandleError --> ReturnResult["返回结果对象"]
HasError --> |否| Success["操作成功"]
Success --> SetStatus["设置状态为成功"]
SetStatus --> ReturnResult
ReturnResult --> End([结束])
```

**图表来源**
- [health/route.ts](file://src/app/api/health/route.ts#L19-L48)
- [flowAPI.ts](file://src/services/flowAPI.ts#L18-L20)

**本节来源**
- [health/route.ts](file://src/app/api/health/route.ts#L19-L48)
- [flowAPI.ts](file://src/services/flowAPI.ts#L18-L20)

## 安全考虑事项

系统在安全方面采取了多项措施，包括密钥管理、数据加密和访问控制策略。

```mermaid
graph TB
subgraph "安全层"
A[环境变量隔离] --> B[ANON_KEY使用]
B --> C[服务角色密钥]
C --> D[行级安全策略]
D --> E[数据访问控制]
E --> F[输入验证]
F --> G[错误处理]
end
subgraph "数据层"
H[数据加密] --> I[传输加密]
I --> J[存储加密]
end
subgraph "应用层"
K[类型安全] --> L[运行时验证]
L --> M[自动保存]
end
安全层 --> 数据层
数据层 --> 应用层
```

**图表来源**
- [supabase.ts](file://src/lib/supabase.ts#L4-L5)
- [health/route.ts](file://src/app/api/health/route.ts#L7)
- [flowAPI.ts](file://src/services/flowAPI.ts#L37-L54)

**本节来源**
- [supabase.ts](file://src/lib/supabase.ts#L4-L5)
- [health/route.ts](file://src/app/api/health/route.ts#L7)
- [flowAPI.ts](file://src/services/flowAPI.ts#L37-L54)