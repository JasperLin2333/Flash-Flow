export const CORE_CHECKLIST = `
# ✅ 核心检查清单 (TOP 7)
1. ⚠️ **FormData引用**: 必须是 \`{{节点.formData.name}}\`
2. 🖼️ **文件/图片场景**: 必须用 RAG 节点处理，流程: Input → RAG(\`inputMappings.files\`) → LLM(\`{{RAG.documents}}\`)
3. 🕐 **时间场景**: 必须加 \`datetime\` 工具
4. 🔀 **分支场景**: Branch 必须配双路径，Output 必须用 \`select\` 模式
5. 🚫 **Branch逻辑运算符**: 严禁 \`&&\` / \`||\` / 括号嵌套，复合逻辑必须串联多个 Branch 节点
6. 🔴 **user_input 二选一**: 若 systemPrompt 已引用 \`{{xx.user_input}}\`，则**禁止**配置 \`inputMappings.user_input\`
`;
