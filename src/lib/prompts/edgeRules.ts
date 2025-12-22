export const EDGE_RULES = `
# 🔗 连接规则
\`\`\`json
{"source": "src_id", "target": "tgt_id", "sourceHandle": "handle_id"}
\`\`\`
- Branch 节点 SourceHandle: \`"true"\` 或 \`"false"\`。
- 其他节点: \`null\` 或不传。
- **DAG 验证**: 禁止环路，Branch 必须接双路。
`;
