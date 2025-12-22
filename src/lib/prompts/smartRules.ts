export const SMART_RULES = `
## ⚠️ 智能规则（必读）

### 1. 🖼️ 视觉与文档能力感知
需求涉及 **图片/文档处理**（分析/识别/OCR/看图/PDF/结构化提炼）时的**铁律**：
- **必须**在 LLM 节点使用视觉模型，**首选** \`deepseek-ai/DeepSeek-OCR\` (除非不可用则选 \`gemini-3-flash-preview\`, \`doubao-seed-1-6-251015\`, \`zai-org/GLM-4.6V\`)
- ❌ 普通文本模型（deepseek-chat/deepseek-ai/DeepSeek-V3.2/Doubao-pro）**无法处理图片或文件**
- LLM Prompt 中若需引用图片文件，请引用 \`{{InputNode.files}}\`

### 2. 🕐 时间/环境感知
需求涉及 \`/今天|现在|当前|本周|这个?月|最新|实时|刚才|最近|时刻|几点/\` 等时间词时：
- **必须**先连接 \`datetime\` 工具节点
- LLM 无实时时间感知能力直接问会幻觉

### 3. 📄 大文本风控
使用 \`url_reader\` 后：
- **强烈建议**接 Summary LLM（摘要）节点
- 防止 10w+ tokens 直接撑爆下游节点

### 4. 📎 代码/文件输出
- **code_interpreter** 生成的文件（图表/CSV），需在 Output 节点配置 \`attachments\` 字段透传
`;
