# LLM 节点记忆功能设计文档

## 1. 概述 (Overview)

LLM 节点的记忆功能为工作流提供多轮对话上下文能力。每个 LLM 节点**独立维护**自己的对话历史，互不干扰。

## 2. 核心设计 (Core Design)

### 2.1 架构组成

记忆功能由以下核心模块协同实现：

*   **执行层 (`LLMNodeExecutor.ts`)**: 负责在节点执行前后调用记忆服务，注入历史上下文并保存新对话。
*   **服务层 (`llmMemoryService.ts`)**: 封装对底层数据库的 CRUD 操作，处理历史记录的获取、追加和裁剪。
*   **数据层 (Supabase `llm_node_memory`)**: 持久化存储对话记录，包含 flow_id, node_id, session_id, role, content, turn_index 等字段。

### 2.2 关键特性

1.  **节点独立记忆**:
    *   每个 LLM 节点维护自己的私有记忆（key: `node.id`）
    *   不同 LLM 节点之间的对话历史互不干扰

2.  **自动上下文管理**:
    *   **最大轮数限制 (`memoryMaxTurns`)**: 自动维护最近 N 轮对话，节省 Token 并避免上下文过长
    *   **自动裁剪**: 每次写入新回复后，自动删除超出限制的旧记录

3.  **会话隔离**:
    *   基于 `sessionId` (执行会话 ID) 进行物理隔离，确保并发执行或不同用户的执行互不干扰

## 3. 执行流程 (Execution Workflow)

当 LLM 节点执行且 `enableMemory = true` 时：

1.  **上下获得 & 变量解析**: 
    *   解析用户输入中的变量（如 `{{输入.formData.value}}`）为实际文本。
    *   调用 `llmMemoryService.getHistory` 获取最近 `maxTurns` 轮的历史记录。
2.  **用户输入保存**: 将解析后的用户输入文本立即保存到数据库（Role: `user`）。
3.  **模型推理**: 将历史记录与当前输入组合，调用 LLM API 获取回复。
4.  **回复保存与维护**: 保存 AI 回复内容（Role: `assistant`）并触发 `trimHistory` 裁剪旧记录。

## 4. 数据结构 (Data Model)

底层存储表 `llm_node_memory` 的逻辑结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `flow_id` | UUID | 所属工作流 ID |
| `node_id` | Text | 节点 ID（每个节点独立） |
| `session_id` | UUID | 执行会话 ID |
| `role` | Text | `user` 或 `assistant` |
| `content` | Text | 对话内容 |
| `turn_index` | Int | 轮次索引，用于排序 |
| `created_at` | Timestamp | 创建时间 |

## 5. 配置参数 (Configuration)

在 LLM 节点的 `data` 字段中配置：

*   `enableMemory` (boolean): 是否开启
*   `memoryMaxTurns` (number): 最大记忆轮数 (默认 10)
