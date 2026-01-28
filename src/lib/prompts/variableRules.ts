export const VARIABLE_RULES = `
# 📌 变量引用与数据流规则 (Variable Rules)

## 1. 核心语法规范
1. **双大括号**: 所有引用必须包裹在 \`{{ }}\` 中。
2. **基于 Label 引用**: 必须使用节点的 **显示名称 (Label)**。禁止使用 ID。
   - ✅ \`{{用户输入.user_input}}\`
   - ❌ \`{{input_1.user_input}}\`
3. **英文命名**: 开发者定义的变量名（如 FormField name, LLM JSON key）必须为纯英文。
   - ✅ \`{{输入.formData.user_age}}\`
   - ❌ \`{{输入.formData.用户年龄}}\`

## 2. 访问模式 (Access Patterns)

### A. 成员访问 (Dot Notation)
适用于对象属性访问。
- \`{{LLM.response}}\` -> 获取全量输出。
- \`{{Input.formData.field_name}}\` -> 获取表单特定字段。

### B. 结构化 JSON 访问
当 LLM 开启 \`responseFormat: "json_object"\` 时：
- **精准取值**: \`{{LLM.response.key_name}}\` (推荐，直接获得值)。
- **传递对象**: \`{{LLM.response.sub_obj}}\` (返回 JSON 字符串)。

### C. 数组与列表访问
- **索引访问**: \`{{Tool.results[0].url}}\` -> 获取搜索结果第一项的 URL。
- **全量列表**: \`{{Input.files}}\` -> 获取所有文件 URL（逗号分隔）。

## 3. 引用分工原则 (Isolation)
为了避免模型混淆，在配置 LLM 节点时：
- **System Prompt**: 引用静态背景、知识库内容（如 \`{{RAG.documents}}\`）。
- **User Input**: 引用动态指令、当前任务参数（如 \`{{Input.user_input}}\`）。

## 4. 严禁事项 (NEVER)
1. **严禁逻辑计算**: 禁止在 \`{{ }}\` 内进行任何运算或条件判断（如 \`{{A + B}}\`）。
2. **严禁裸变量**: 严禁省略节点前缀（如 \`{{user_input}}\`）。
3. **严禁逻辑模板**: 禁止使用 Handlebars 逻辑标签（如 \`{{#each}}\`）。
`;
