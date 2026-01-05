export const EDGE_RULES = `
# 🔗 连接规则

\`\`\`json
{"source": "src_id", "target": "tgt_id", "sourceHandle": "handle_id"}
\`\`\`

### sourceHandle 规则
| 节点类型 | sourceHandle | 说明 |
|---------|-------------|------|
| **Branch** | \`"true"\` 或 \`"false"\` | 条件分支路径 |
| **其他节点** | \`null\` 或不传 | 默认输出 |

### 执行规则
- **DAG 验证**: 禁止循环依赖，系统自动检测
- **并行执行**: 同层级无依赖节点自动并行
- **分支阻塞**: Branch 未选中路径的所有下游节点不执行
`;
