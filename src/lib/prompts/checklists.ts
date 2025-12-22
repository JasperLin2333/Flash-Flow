export const CORE_CHECKLIST = `
# ✅ 核心检查清单 (TOP 6)
1. ⚠️ **FormData引用**: 必须是 \`{{节点.formData.name}}\`
2. ⚠️ **LLM文件引用**: 必须引用 \`{{节点.files}}\` (勿用下标)
3. 🖼️ **视觉场景**: 必须用视觉模型 (\`deepseek-ai/DeepSeek-OCR\` / \`doubao-seed-1-6-251015\` / \`gemini-3-flash-preview\` / \`zai-org/GLM-4.6V\`)
4. 🕐 **时间场景**: 必须加 \`datetime\` 工具
5. 🔀 **分支场景**: Branch 必须配双路径，Output 必须用 \`select\` 模式
6. 🔴 **user_input 二选一**: 若 systemPrompt 已引用 \`{{xx.user_input}}\`，则**禁止**配置 \`inputMappings.user_input\`
`;
