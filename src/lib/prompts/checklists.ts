export const CORE_CHECKLIST = `
# ✅ 核心检查清单 (TOP 7)

1. ⚠️ **FormData 引用**: 必须是 \`{{节点.formData.fieldName}}\`，禁止 \`{{formData.x}}\`
2. 🖼️ **文件/图片场景**: 必须用 RAG 节点处理
   - Input(\`enableFileInput\`) → RAG(\`retrievalVariable: "{{输入.files}}"\`) → LLM(\`{{RAG.documents}}\`)
3. 🕐 **时间场景**: 必须加 \`datetime\` 工具节点，LLM 无实时时间感知
4. 🔀 **分支场景**: 
   - Branch 必须配 \`true\`/\`false\` 双路径
   - Output 用 \`select\` 模式选择首个非空值
5. ✅ **Branch 逻辑组合**: 支持 \`&&\`(AND) 和 \`||\`(OR)，运算符前后需空格
6. 🔴 **user_input 二选一**: 
   - 若 systemPrompt 已引用 \`{{xx.user_input}}\` → **禁止**配置 \`inputMappings.user_input\`
7. 📎 **附件输出**: Output 节点的 \`attachments\` 支持:
   - 文件数组: \`{{输入.files}}\`
   - 图片 URL: \`{{图片生成.imageUrl}}\`
   - 生成文件: \`{{代码.generatedFile}}\`
`;
