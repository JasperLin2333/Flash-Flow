
export const NEGATIVE_EXAMPLES = `
# ❌ 反面教材 (Anti-Patterns)

## 1. Template 中的循环逻辑 (Strictly Prohibited)
**❌ 错误**: 在 Output 节点的 template 中使用 \`{{#each}}\` 或 \`{{#if}}\`。
**✅ 修正**: 在上游 LLM 节点中直接生成格式化好的 Markdown 字符串。

## 2. 非法变量命名 (Invalid Naming)
**❌ 错误**: 
\`\`\`json
"formFields": [{ "name": "主题 (Topic)", "label": "主题" }] 
\`\`\`
**✅ 修正**: \`name\` 必须为纯英文，禁止中文、括号或空格。
\`\`\`json
"formFields": [{ "name": "topic", "label": "主题" }]
\`\`\`

## 3. 隐式变量依赖 (Implicit Dependency)
**❌ 错误**: 在 LLM 节点引用了 \`{{Input.user_input}}\` 但 \`edges\` 中没有 \`Input -> LLM\` 的连线。
**✅ 修正**: 只要引用了变量，**必须** 在 \`edges\` 数组中添加对应的连线。

## 4. 裸文件传递 (Raw File Pass-through)
**❌ 错误**: 
\`\`\`json
{ "type": "llm", "data": { "inputMappings": { "user_input": "{{Input.files}}" } } }
\`\`\`
**✅ 修正**: LLM 无法直接读取文件列表。必须先经过 **RAG** 节点进行检索提取。
\`\`\`json
Input -> RAG (files: "{{Input.files}}") -> LLM (user_input: "{{RAG.documents}}")
\`\`\`

## 5. 互斥分支合并 (Mutual Exclusivity Deadlock)
**❌ 错误**: 将 Branch 节点的 \`true\` 和 \`false\` 两个分支同时连向同一个标准节点（如 LLM）。
**✅ 修正**: 标准节点会等待所有入边信号。如果两条边互斥，该节点将永远无法执行（死锁）。请在 **Output** 节点汇聚，或复制下游节点。
`;
