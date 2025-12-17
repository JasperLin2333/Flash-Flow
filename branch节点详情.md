# Branch 节点 (分支节点)

## 功能描述

基于条件表达式控制流程的分支走向。内置**安全表达式求值器**，通过白名单机制防止代码注入，确保执行安全。

## 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|-----|-------|------|
| `label` | string | ✅ | - | 节点显示名称 |
| `condition` | string | ❌ | `""` | 判断条件表达式 (见下文) |
| `customOutputs` | array | ❌ | `[]` | 用户自定义输出变量列表 `{name, value}` |

> [!NOTE]
> 如果 `condition` 为空，节点默认返回 `true`，以保证流程连通性。

## 核心执行逻辑 (Execution Logic)

1.  **节点查找**: 支持使用 **节点ID** 或 **节点名称 (Label)** 引用上游数据。查找时忽略大小写。系统使用 Map 实现 O(1) 查找性能。
2.  **安全求值**: 表达式必须符合白名单格式（预编译的正则匹配），否则直接返回 `false` 并记录警告。
3.  **结果透传**: 节点会透传上游节点的所有数据（自动过滤 `_meta` 等内部字段），并附加 `conditionResult` 字段。

## 支持的表达式格式 (White-list)

为确保安全，仅支持以下几种特定的表达式格式。`NodeName` 代表上游节点的名称或 ID，支持中文节点名称。

### 1. 字符串匹配

*   **包含**: `NodeName.field.includes('value')`
*   **前缀**: `NodeName.field.startsWith('value')`
*   **后缀**: `NodeName.field.endsWith('value')`

### 2. 等值判断 (Equality)

支持字符串、数字、布尔值的比较。

*   **相等**: `NodeName.field === 'value'` 或 `NodeName.field === 123` 或 `NodeName.field === true`
*   **不等**: `NodeName.field !== 'value'`

### 3. 数值比较 (Comparison)

仅支持数值类型。

*   **大于**: `NodeName.field > 10`
*   **大于等于**: `NodeName.field >= 10.5`
*   **小于**: `NodeName.field < 100`
*   **小于等于**: `NodeName.field <= 50`

### 4. 嵌套属性访问

支持多级路径访问。

*   `NodeName.data.result.score > 0.8`
*   `NodeName.response.length > 5` (字符串长度判断)

> [!TIP]
> 正则模式示例：
> - 节点名称支持：字母、中文、下划线、数字 (首字符不能是数字)
> - 完整格式：`NodeName.path.to.field` + 操作符 + 值

## 输出格式 (Output Format)

```typescript
{
  "passed": true,             // 固定为 true，表示节点自身执行成功
  "conditionResult": boolean, // 条件表达式的求值结果 (true/false)
  ...upstreamData             // 上游节点数据的完整副本 (已过滤敏感字段)
}
```

### 连线逻辑
*   **True 路径**: 当 `conditionResult` 为 `true` 时，激活连接到 "True" 句柄的下游节点。
*   **False 路径**: 当 `conditionResult` 为 `false` 时，激活连接到 "False" 句柄的下游节点。
