export const SMART_RULES = `
## ⚠️ 智能规则（必读）

### 1. 🖼️ 文件/图片处理能力感知
需求涉及 **图片/文档处理**（分析/识别/OCR/看图/PDF/结构化提炼）时的**铁律**：
- **必须**使用 RAG 节点处理文件/图片，LLM 节点无法直接读取文件内容
- ✅ 正确流程: Input(上传文件) → RAG(配置 \`inputMappings.files\`) → LLM(引用 \`{{RAG.documents}}\`)
- ❌ **禁止**直接将 \`{{xx.files}}\` 传给 LLM 节点

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
