# 确定性修复（Deterministic Fix）说明

## 目标
确定性修复用于在“生成工作流结构（nodes/edges）”之后，对结构做**低副作用、可证明**的自动修补：
- 同样输入得到同样输出（可预测）
- 修复内容可解释（有 fixes 日志）
- 修不完也不阻断（始终放行返回 result）

## 做什么（会自动修）
- 删除无效连线：source/target 缺失或引用不存在节点
- 去重连线：同 source/target/sourceHandle 的重复边
- 补齐 edge.id：为缺失 id 的边生成稳定 id
- 连线端点纠正：若使用了节点 label 作为 source/target，且能唯一确定节点，会纠正为节点 id
- 变量确定性归一：
  - 将 `{{<InputLabel>.text}}` 归一为 `{{<InputLabel>.user_input}}`（仅在能确定前缀指向 input 节点时）
  - 将 `{{<nodeId>.*}}` 替换为 `{{<nodeLabel>.*}}`（仅当 id 形态明显为系统生成，且 label 可安全作为变量前缀）

## 不做什么（只报告，不自动修）
- 不删环（cycle fix）
- 不连孤岛（island fix）
- 不做模糊匹配变量（如 Levenshtein、空格/大小写猜测后直接改写）

## 放行策略（重要）
- 生成阶段即使存在 Hard Error，也会返回工作流给用户；确定性修复只影响“是否采用修复后的版本”。

## 开关说明
### 生成阶段：校验与确定性修复
- `FLOW_VALIDATION_REPORT_ENABLED=true|false`：是否输出生成阶段校验/修复报告（默认 false）
- `FLOW_VALIDATION_SAFE_FIX_ENABLED=true|false`：是否启用确定性修复（默认 false）
- `FLOW_DETERMINISTIC_FIX_INCLUDE_IO=true|false`：是否在确定性修复中包含自动补齐 Input/Output（默认 false）

子项（默认 true；设为 false 可关闭单项）：
- `FLOW_SAFE_FIX_REMOVE_INVALID_EDGES`
- `FLOW_SAFE_FIX_DEDUPE_EDGES`
- `FLOW_SAFE_FIX_ENSURE_EDGE_IDS`
- `FLOW_SAFE_FIX_ID_TO_LABEL`

### validateWorkflow（确定性版）
- `NEXT_PUBLIC_FLOW_VALIDATE_WORKFLOW_ENABLED=true|false`：前端是否请求执行 validateWorkflow（默认 false）
- `FLOW_VALIDATE_WORKFLOW_REPORT_ENABLED=true|false`：是否输出 validateWorkflow 的修复日志 step（默认 false）

### 前端调试展示
- `NEXT_PUBLIC_FLOW_VALIDATION_REPORT_UI=true|false`：UI 是否展示 validation/validation_fix 步骤（默认 false）

## 代码入口
- 统一确定性修复入口：`deterministicFixWorkflowV1`
  - [deterministicFixerV1.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/lib/agent/deterministicFixerV1.ts)
- 生成阶段校验：`validateGeneratedWorkflowV1_2`
  - [generatedWorkflowValidatorV1.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/lib/agent/generatedWorkflowValidatorV1.ts)
- 生成接口接入点：
  - [agent/plan/route.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/app/api/agent/plan/route.ts)
  - [plan/route.ts](file:///Users/jasperlin/Desktop/product/flash-flow-saas/flash-flow/src/app/api/plan/route.ts)
