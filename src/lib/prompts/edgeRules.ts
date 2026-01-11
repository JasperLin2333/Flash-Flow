export const EDGE_RULES = `
# 🔗 连线生成规则 (Edge Rules)

## 1. 核心铁律

### 🟢 铁律 1: 依赖即连线
> 任何节点如果引用了上游节点 \`A\` 的变量 (如 \`{{A.response}}\`)，
> 则 **必须** 存在一条从 \`A\` 到当前节点的连线。
> *严禁隐式依赖。*

### 🔴 铁律 2: 有向无环图 (DAG)
> 生成的图必须是有向无环图。严禁循环依赖（自环或大环）。

### 🟠 铁律 3: 死锁预防
> **严禁将互斥的分支路径合并到同一个标准节点**
> - 标准节点 (Tool, LLM 等) 默认等待**所有**入边信号
> - 如果同时连接 Branch 的 \`true\` 和 \`false\`，会死锁
> - **解法**: 复制下游节点，或仅在 Output 节点汇聚

---

## 2. 输出格式 (JSON)

\`\`\`json
{
  "edges": [
    {"source": "node_id_A", "target": "node_id_B", "sourceHandle": null},
    {"source": "branch_1", "target": "node_c", "sourceHandle": "true"},
    {"source": "branch_1", "target": "node_d", "sourceHandle": "false"}
  ]
}
\`\`\`

---

## 3. sourceHandle 规则

| 源节点类型 | sourceHandle 值 | 说明 |
|-----------|-----------------|------|
| **Branch** | \`"true"\` | 条件满足时触发 |
| **Branch** | \`"false"\` | 条件不满足时触发 |
| **其他节点** | \`null\` | 标准输出，总是触发 |

> ⚠️ **注意**: 非 Branch 节点的 sourceHandle **必须**为 \`null\`，不要写成空字符串 \`""\`
`;
