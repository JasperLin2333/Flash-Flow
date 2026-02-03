export const VARIABLE_RULES = `
# 📌 变量引用与数据流规则 (Variable Rules)

## 1. 核心语法规范 (Syntax)
1. **双大括号**: 在节点配置的字符串中，变量引用必须包裹在 \`{{ }}\` 中（如 \`{{用户输入.user_input}}\`）。
2. **禁止逻辑计算**: 严禁在 \`{{ }}\` 内进行任何运算、条件判断或函数调用（如 \`{{A + B}}\` 或 \`{{A.toLowerCase()}}\`）。逻辑必须交由 LLM 或 Branch 节点处理（Branch 的条件表达式规则见下文）。
3. **禁止逻辑模板**: 严禁使用 Handlebars 逻辑标签（如 \`{{#each}}\`, \`{{#if}}\`, \`{{#unless}}\`, \`{{#with}}\` 等）。
   - 🔴 **特别注意 Output 节点**: Template 模式中绝对禁止任何形式的循环、条件判断等逻辑语法
   - ✅ 正确做法: 将复杂逻辑交给上游 LLM 节点处理，在 Output 节点中仅做简单的变量替换

## 2. 命名与引用规则 (Naming & Reference)
1. **纯英文变量名**: 所有开发者定义的 ID、字段名（如 FormField name, LLM JSON key）**必须**为纯英文。禁止中文、空格或特殊字符。
   - ✅ \`topic\`, \`user_age\`
   - ❌ \`主题\`, \`user age\`
2. **基于 Label 引用**: 必须优先使用节点的 **显示名称 (Label)**。
   - ✅ \`{{用户输入.user_input}}\`
   - ✅ \`{{风险评估.response}}\`
3. **禁止使用随机 ID**: 严禁使用系统生成的随机 ID（如 \`node_a7b2\`）。
4. **前缀必须可解析**: 变量前缀必须是"节点 Label"或"节点 id"（两者至少满足一个）。
   - ✅ 若 Input 节点 label 叫"用户诉求"：\`{{用户诉求.user_input}}\`
   - ✅ 若 LLM 节点 id 叫"llm"：\`{{llm.response}}\`
   - ⚠️ 不要凭空使用 \`{{Input.xxx}}\` / \`{{LLM.xxx}}\`，除非你把对应节点的 label 或 id 就命名为 \`Input\` / \`LLM\`。
5. **严禁裸变量**: 引用必须包含节点前缀。
   - ❌ \`{{user_input}}\`

## 3. 访问模式 (Access Patterns)
### B. 结构化 JSON 访问
当 LLM 节点需要被下游精准取值时：
1. **必须开启开关**: 在该 LLM 节点的 data 中设置 \`responseFormat: "json_object"\`。
2. **精准取值**: \`{{<LLM节点Label>.response.key_name}}\`（推荐，直接获得值）
3. **传递对象**: \`{{<LLM节点Label>.response.sub_obj}}\`（返回 JSON 字符串）
- **数组访问**: \`{{<Tool节点Label>.results[0].url}}\`
- **全量列表**: \`{{<Input节点Label>.files}}\`（返回文件对象数组）

## 4. Branch 条件表达式（重要）
Branch 的 \`condition\` 不是 Handlebars 模板，它是"受限的白名单表达式"：
- 允许在 \`{{节点前缀.字段}}\` **外部**拼接运算符与函数（白名单）
  - ✅ \`{{意图识别.response}} === 'REFUND'\`
  - ✅ \`{{用户诉求.user_input}}.includes('退款')\`
  - ✅ \`{{评分.response.score}} >= 60 && {{用户诉求.user_input}}.includes('旅行')\`
- 禁止把整段条件包进 \`{{ }}\` 里做计算
  - ❌ \`{{ 意图识别.response === 'REFUND' }}\`
  - ❌ \`{{ 用户诉求.user_input.includes('退款') }}\`

## 5. Output 节点模板专用规则 (Output Template Rules)
Output 节点的 template 模式有特殊约束：

### 5.1 严格禁止的语法
**绝对禁止**在 Output 节点 template 中使用任何 Handlebars 逻辑标签：
- ❌ \`{{#each items}}...{{/each}}\` - 循环语法
- ❌ \`{{#if condition}}...{{/if}}\` - 条件语法  
- ❌ \`{{#unless condition}}...{{/unless}}\` - 反向条件
- ❌ \`{{#with context}}...{{/with}}\` - 上下文切换
- ❌ \`{{else}}\`, \`{{^}}\` - 分支语法

### 5.2 正确的替代方案
当需要处理列表或条件逻辑时，应该：
1. **上游处理**: 在 LLM 节点中生成格式化的完整文本
2. **简单引用**: Output 节点仅引用已处理好的变量

## 6. 隔离原则 (Isolation)
在配置 LLM 节点时，应遵循输入隔离：
- **System Prompt**: 引用静态背景、知识库内容（如 \`{{<RAG节点Label>.documents}}\`）。
- **User Input**: 引用动态指令、用户当前输入（如 \`{{<Input节点Label>.user_input}}\`）。
`;