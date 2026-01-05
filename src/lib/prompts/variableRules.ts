export const VARIABLE_RULES = `
## 📌 变量引用铁律 (Ref Strategy)

> 🔴 **变量引用格式铁律 - 必须精确匹配！**
> - **必须包含双大括号**: 所有引用必须用 \`{{ }}\` 包裹
> - **必须精确匹配 Label**: 变量前缀必须与来源节点的 \`data.label\` **完全一致**
> - ✅ 正确格式: \`{{节点名.属性名}}\` 如 \`{{用户输入.user_input}}\`
> - ❌ **严禁无前缀**: \`{{user_input}}\` / \`{{files}}\`
> - ❌ **严禁用ID**: 若节点名称是"小红书改写"，禁止用 \`{{xhs_writer.response}}\`
> - ❌ **严禁点号直连**: 禁止 \`input_node.formData.type\`，必须 \`{{xx.formData.type}}\`

### 变量优先级
1. **直接上游** context (最高优先级)
2. **全局** flowContext

### 各节点输出变量速查

| 节点类型 | 输出变量 | 示例 |
|---------|---------|------|
| **Input** | \`user_input\`, \`files\`, \`formData\` | \`{{用户输入.user_input}}\`, \`{{用户输入.files}}\`, \`{{用户输入.formData.mode}}\` |
| **LLM** | \`response\`, \`reasoning\` | \`{{内容生成.response}}\` |
| **RAG** | \`documents\`, \`citations\`, \`query\`, \`documentCount\`, \`mode\` | \`{{知识检索.documents}}\` |
| **Tool** | 工具特定 (见下方) | \`{{搜索.results}}\`, \`{{时间.formatted}}\` |
| **Branch** | \`conditionResult\`, \`passed\`, + 透传字段 | \`{{分支.conditionResult}}\` |
| **Output** | \`text\`, \`attachments\` | - |
| **ImageGen** | \`imageUrl\` | \`{{图片生成.imageUrl}}\` |

### Tool 节点输出变量
| 工具 | 输出变量 |
|------|---------|
| \`web_search\` | \`results\` (数组), \`count\` |
| \`url_reader\` | \`content\`, \`title\`, \`truncated\` |
| \`calculator\` | \`expression\`, \`result\` |
| \`datetime\` | \`formatted\`, \`timestamp\`, \`operation\` |
| \`code_interpreter\` | \`logs\`, \`errors\`, \`result\`, \`generatedFile\` |

### 嵌套路径访问
支持点号分隔的嵌套访问:
- \`{{节点.formData.fieldName}}\` - 表单字段
- \`{{节点.data.nested.value}}\` - 嵌套对象
`;
