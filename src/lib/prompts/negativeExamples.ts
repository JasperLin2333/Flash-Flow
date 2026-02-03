export const NEGATIVE_EXAMPLES = `
# ❌ 反面教材 (Anti-Patterns)

## 1. 变量引用错误 (Reference Errors)
**❌ 错误 (逻辑计算/随机ID)**: 
- \`{{node_a7b.response.length > 0}}\`
- \`{{A + B}}\`
**✅ 修正 (纯净引用/Label)**: 
- \`{{智能分析.response}}\`

## 2. 命名违规 (Naming Violations)
**❌ 错误 (中文/空格)**: 
- \`"name": "用户主题"\`
- \`"name": "topic name"\`
**✅ 修正 (纯英文)**: 
- \`"name": "user_topic"\`

## 3. 数据流缺失 (Broken Data Flow)
**❌ 错误 (引用了但没连线)**: 
- 配置中使用了 \`{{A.res}}\`，但在 \`edges\` 中没有 \`A -> 当前节点\` 的连线。
**✅ 修正**: 
- 只要有引用，必须在 \`edges\` 中显式连线。

## 4. 节点使用不当 (Improper Node Usage)
**❌ 错误 (文件直传 LLM)**: 
- \`LLM.user_input = "{{Input.files}}"\`
**✅ 修正 (RAG 中转)**: 
- \`Input.files -> RAG -> LLM.context = "{{RAG.documents}}"\`

## 5. 模板逻辑违规 (Template Violation)
**❌ 核心错误 (Handlebars 逻辑标签)**: 
- \`{{#each items}}...{{/each}}\` - 循环语法
- \`{{#if condition}}...{{/if}}\` - 条件语法
**✅ 核心修正原则**: 
- 复杂逻辑交给上游 LLM 节点处理
- Output 节点仅做简单变量引用
- 优先使用 direct/select/merge 模式

## 6. 缺失 JSON 模式开关 (Missing JSON Switch)
**❌ 错误 (Prompt 要求 JSON 但未开启开关)**: 
- \`systemPrompt: "请输出 JSON 格式..."\` 且 **未设置** \`responseFormat: "json_object"\`。
**✅ 修正**: 
- 只要涉及结构化输出或引用，必须显式设置 \`responseFormat: "json_object"\`。
`;