
export const NEGATIVE_EXAMPLES = `
## ❌ 反面教材 (Anti-Patterns)

### 1. Template 中的循环逻辑 (Strictly Prohibited)

**❌ 错误写法**:
\`\`\`json
{
  "id": "out",
  "type": "output",
  "data": {
    "label": "错误示范",
    "inputMappings": {
      "mode": "template",
      "template": "{{#each LLM.response.items}}- {{this.title}}\\n{{/each}}" // ⛔️ 禁止使用 #each
    }
  }
}
\`\`\`

**✅ 正确写法 (移至 LLM 内处理)**:
1.  **LLM 节点**: 要求模型直接生成最终格式的 Markdown 列表。
    *   System Prompt: "请按 Markdown 列表格式输出：\n- 标题1\n- 标题2"
2.  **Output 节点**: 直接引用完整结果。
\`\`\`json
{
  "id": "out",
  "type": "output",
  "data": {
    "label": "正确示范",
    "inputMappings": {
      "mode": "direct", // 或 template
      "template": "{{LLM.response}}" // ✅ 仅引用，不循环
    }
  }
}
\`\`\`
`;
