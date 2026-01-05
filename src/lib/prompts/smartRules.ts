export const SMART_RULES = `
## ⚠️ 智能规则（必读）

### 1. 🖼️ 文件/图片处理铁律
需求涉及 **图片/文档处理**（分析/识别/OCR/看图/PDF/提炼）：
- **必须**使用 RAG 节点，LLM 无法直接读取文件
- ✅ 正确流程: Input(上传) → RAG(\`retrievalVariable: "{{输入.files}}"\`) → LLM(\`{{RAG.documents}}\`)
- ❌ 禁止将 \`{{xx.files}}\` 直接传给 LLM

### 2. 🕐 时间/环境感知
需求涉及 \`/今天|现在|当前|本周|这个?月|最新|实时|刚才|最近|时刻|几点/\` 等时间词：
- **必须**先连接 \`datetime\` 工具节点
- LLM 无实时时间感知，直接问会幻觉

### 3. 📄 大文本风控
使用 \`url_reader\` 后：
- **建议**接 Summary LLM（摘要）节点
- 防止 10w+ tokens 撑爆下游节点

### 4. 📎 代码/文件输出
- \`code_interpreter\` 生成的文件需在 Output 配置 \`attachments\`
- 格式: \`{"type": "variable", "value": "{{代码.generatedFile}}"}\`

### 5. 🧠 记忆功能
LLM 节点的 \`enableMemory\` 配置：
| 场景 | enableMemory |
|------|-------------|
| 客服/对话/聊天/问答/助手 | \`true\` |
| 翻译/摘要/分类/提取/分析 | \`false\` |

### 6. 🔄 流式输出
Output 模式影响上游 LLM 的流式行为：
| Output 模式 | 流式 | 说明 |
|------------|------|------|
| \`direct\` | ✅ | 单源流式 |
| \`select\` | ✅ | 首字锁定 |
| \`merge\` | ✅ | 分段流式 |
| \`template\` | ❌ | 等待所有变量 |
`;
