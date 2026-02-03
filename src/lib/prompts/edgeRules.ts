export const EDGE_RULES = `
# 🔗 连线与拓扑规则 (Edge Rules)

## 1. 核心铁律 (MUST)
1. **依赖即连线**: 任何节点如果引用了上游节点 \`A\` 的变量 (如 \`{{A.response}}\`)，则 **必须** 存在一条从 \`A\` 到当前节点的连线。严禁隐式依赖。
2. **有向无环图 (DAG)**: 生成的图必须是 DAG。严禁循环依赖（自环或大环）。
3. **死锁预防 (Mutual Exclusivity)**: 
   - **严禁** 将 Branch 节点的 \`true\` 和 \`false\` 分支路径直接合并到同一个标准节点（如 LLM, Tool）。
   - **原因**: 标准节点默认等待所有入边信号。由于分支互斥，该节点将永远无法触发。
   - **解法**: 复制下游节点，或仅在 **Output** 节点（使用 \`mode: "select"\`）进行汇聚。

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

## 3. sourceHandle 规则
| 源节点类型 | sourceHandle 值 | 说明 |
|-----------|-----------------|------|
| **Branch** | \`"true"\` | 条件满足时触发 |
| **Branch** | \`"false"\` | 条件不满足时触发 |
| **其他节点** | \`null\` | 标准输出，总是触发 |

⚠️ **注意**: 非 Branch 节点的 sourceHandle **必须**为 \`null\`，禁止为空字符串 \`""\`。
`;
