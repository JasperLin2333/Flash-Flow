import { NEGATIVE_EXAMPLES } from './negativeExamples';

export const FLOW_EXAMPLES = `
# 📋 关键示例

## 1. 🖼️ 文档智能分析 (RAG + LLM)
\`\`\`json
{"title": "合同分析助手", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "上传合同", "enableFileInput": true, "textRequired": true, "fileConfig": {"allowedTypes": [".pdf", ".doc", ".docx"], "maxSizeMB": 50, "maxCount": 3}, "greeting": "请上传需要审查的合同文件，并补充你关注的问题（例如付款条款/违约责任/终止条件）"}},
  {"id": "rag", "type": "rag", "data": {"label": "提取条款", "fileMode": "variable", "inputMappings": {"files": "{{上传合同.files}}", "query": "付款条款、违约责任、终止条件"}, "maxTokensPerChunk": 400}},
  {"id": "llm", "type": "llm", "data": {"label": "风险评估", "model": "deepseek-chat", "temperature": 0.3, "inputMappings": {"user_input": "{{上传合同.user_input}}"}, "systemPrompt": "# 角色\n资深法务顾问\n\n# 任务\n结合用户问题和提取的合同条款进行风险评估。\n\n# 合同条款背景\n{{提取条款.documents}}\n\n# 要求\n1. 针对用户问题进行回答\n2. 列出潜在风险点 (High/Medium/Low)\n3. 引用原文条款"}},
  {"id": "out", "type": "output", "data": {"label": "评估报告", "inputMappings": {"mode": "direct", "sources": [{"type": "variable", "value": "{{风险评估.response}}"}]}}}
], "edges": [{"source": "in", "target": "rag"}, {"source": "rag", "target": "llm"}, {"source": "in", "target": "llm"}, {"source": "llm", "target": "out"}]}
\`\`\`

## 2. 🎨 创意海报生成 (Structured Form + ImageGen)
\`\`\`json
{"title": "节日海报生成器", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "设计需求", "enableStructuredForm": true, "formFields": [{"name": "topic", "label": "节日主题", "type": "text", "required": true}, {"name": "style", "label": "艺术风格", "type": "select", "options": ["3D C4D渲染", "扁平插画", "水彩手绘", "赛博朋克"], "required": true}], "greeting": "填写节日主题和风格，一键生成海报"}},
  {"id": "llm", "type": "llm", "data": {"label": "创意Prompt", "model": "qwen-flash", "temperature": 0.8, "inputMappings": {"user_input": "主题：{{设计需求.formData.topic}}，风格：{{设计需求.formData.style}}"}, "systemPrompt": "# 任务\n编写高质量的英文AI绘图Prompt。\n\n# 要求\n仅输出Prompt，包含：Subject, Medium, Style, Lighting, Color Palette, Quality tags。"}},
  {"id": "img", "type": "imagegen", "data": {"label": "绘图", "model": "Kwai-Kolors/Kolors", "prompt": "{{创意Prompt.response}}", "imageSize": "768x1024", "cfg": 7.5, "numInferenceSteps": 25}},
  {"id": "out", "type": "output", "data": {"label": "海报预览", "inputMappings": {"mode": "template", "template": "### 海报已生成\n\n**创意灵感**: {{创意Prompt.response}}", "attachments": [{"type": "variable", "value": "{{绘图.imageUrl}}"}]}}}
], "edges": [{"source": "in", "target": "llm"}, {"source": "llm", "target": "img"}, {"source": "img", "target": "out"}]}
\`\`\`

## 3. 🧠 记忆型私人助理 (Memory + Tools)
\`\`\`json
{"title": "全能助理", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "用户指令", "enableTextInput": true, "greeting": "你好！我是你的AI助理，有什么日程安排或问题吗？"}},
  {"id": "time", "type": "tool", "data": {"label": "获取时间", "toolType": "datetime", "inputs": {"operation": "now", "format": "YYYY-MM-DD HH:mm dddd"}}},
  {"id": "llm", "type": "llm", "data": {"label": "思考与回复", "model": "deepseek-chat", "temperature": 0.7, "enableMemory": true, "memoryMaxTurns": 20, "inputMappings": {"user_input": "{{用户指令.user_input}}"}, "systemPrompt": "# 当前时间\n{{获取时间.formatted}}\n\n# 角色\n你是一个拥有长期记忆的私人助理。请结合上下文和当前时间回答用户问题。"}},
  {"id": "out", "type": "output", "data": {"label": "回复", "inputMappings": {"mode": "direct", "sources": [{"type": "variable", "value": "{{思考与回复.response}}"}]}}}
], "edges": [{"source": "in", "target": "time"}, {"source": "time", "target": "llm"}, {"source": "llm", "target": "out"}]}
\`\`\`

## 4. 🌐 综合研报助手 (Search + RAG)
\`\`\`json
{"title": "综合研报助手", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "研报需求", "enableFileInput": true, "greeting": "请上传 PDF 资料并输入你想查询的问题", "fileConfig": {"maxCount": 2, "allowedTypes": [".pdf"], "maxSizeMB": 20}}},
  {"id": "search", "type": "tool", "data": {"label": "实时搜索", "toolType": "web_search", "inputs": {"query": "{{研报需求.user_input}}", "maxResults": 3}}},
  {"id": "rag", "type": "rag", "data": {"label": "本地检索", "fileMode": "variable", "inputMappings": {"files": "{{研报需求.files}}", "query": "{{研报需求.user_input}}"}}},
  {"id": "llm", "type": "llm", "data": {"label": "深度分析", "model": "deepseek-chat", "inputMappings": {"user_input": "{{研报需求.user_input}}"}, "systemPrompt": "# 任务\n结合上传的文档和网络搜索结果回答问题。\n\n# 本地文档内容\n{{本地检索.documents}}\n\n# 网络搜索摘要\n{{实时搜索.results[0].snippet}}\n\n# 用户的原始问题\n{{研报需求.user_input}}"}},
  {"id": "out", "type": "output", "data": {"label": "分析结论", "inputMappings": {"mode": "direct", "sources": [{"type": "variable", "value": "{{深度分析.response}}"}]}}}
], "edges": [{"source": "in", "target": "search"}, {"source": "in", "target": "rag"}, {"source": "rag", "target": "llm"}, {"source": "search", "target": "llm"}, {"source": "llm", "target": "out"}]}
\`\`\`

## 5. 🎭 风格迁移 (ImageGen Reference)
\`\`\`json
{"title": "照片转动漫", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "上传照片", "enableFileInput": true, "textRequired": true, "fileConfig": {"allowedTypes": [".png", ".jpg", ".jpeg"], "maxCount": 1, "maxSizeMB": 5}, "greeting": "上传一张照片，并描述你想要的动漫风格（例如：日漫/赛博朋克/水彩）"}},
  {"id": "img", "type": "imagegen", "data": {"label": "动漫化", "model": "Qwen/Qwen-Image-Edit-2509", "prompt": "anime style, japanese anime, vibrant colors, high quality, detailed", "referenceImageMode": "variable", "referenceImageVariable": "{{上传照片.files[0].url}}", "cfg": 4.0, "numInferenceSteps": 50}},
  {"id": "out", "type": "output", "data": {"label": "效果展示", "inputMappings": {"mode": "direct", "sources": [{"type": "static", "value": "转换完成！"}], "attachments": [{"type": "variable", "value": "{{动漫化.imageUrl}}"}]}}}
], "edges": [{"source": "in", "target": "img"}, {"source": "img", "target": "out"}]}
\`\`\`


## 6. 📊 数据深度分析 (Code Interpreter)
\`\`\`json
{"title": "销售数据分析", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "上传数据", "enableFileInput": true, "fileConfig": {"allowedTypes": [".csv", ".xlsx"], "maxCount": 1, "maxSizeMB": 20}, "greeting": "请上传销售数据表，告诉我你想分析什么趋势"}},
  {"id": "llm", "type": "llm", "data": {"label": "生成代码", "model": "deepseek-chat", "temperature": 0.1, "responseFormat": "json_object", "inputMappings": {"user_input": "分析目标：{{上传数据.user_input}}"}, "systemPrompt": "# 任务\n编写Python代码分析数据并画图。\n\n# 约束\n- 数据文件: 'data.csv'\n- 输出图片: 'plot.png'\n- 输出JSON格式: {\\\"code\\\": \\\"...\\\", \\\"outputFileName\\\": \\\"plot.png\\\"}"}},
  {"id": "code", "type": "tool", "data": {"label": "执行分析", "toolType": "code_interpreter", "inputs": {"code": "{{生成代码.response.code}}", "inputFiles": [{"name": "data.csv", "url": "{{上传数据.files[0].url}}"}], "outputFileName": "plot.png"}}},
  {"id": "out", "type": "output", "data": {"label": "分析报告", "inputMappings": {"mode": "template", "template": "### 分析完成\\n\\n{{执行分析.logs}}", "attachments": [{"type": "variable", "value": "{{执行分析.generatedFile.url}}"}]}}}
], "edges": [{"source": "in", "target": "llm"}, {"source": "llm", "target": "code"}, {"source": "code", "target": "out"}]}
\`\`\`

## 7. 🔀 智能客服分流 (Branch Logic)
\`\`\`json
{"title": "自动售后分流", "nodes": [
  {"id": "in", "type": "input", "data": {"label": "用户诉求", "greeting": "您好，请描述您遇到的问题"}},
  {"id": "llm", "type": "llm", "data": {"label": "意图识别", "model": "qwen-flash", "temperature": 0.1, "inputMappings": {"user_input": "{{用户诉求.user_input}}"}, "systemPrompt": "# 任务\n判断用户意图，仅输出以下关键词之一：\n- REFUND\n- TECHNICAL\n- OTHER"}},
  {"id": "br_refund", "type": "branch", "data": {"label": "是否退款", "condition": "{{意图识别.response}} === 'REFUND'"}},
  {"id": "op_refund", "type": "llm", "data": {"label": "退款处理", "model": "deepseek-chat", "inputMappings": {"user_input": "{{用户诉求.user_input}}"}, "systemPrompt": "你是一个售后客服，负责引导用户提供订单号进行退款。"}},
  {"id": "op_tech", "type": "llm", "data": {"label": "技术支持", "model": "deepseek-chat", "inputMappings": {"user_input": "{{用户诉求.user_input}}"}, "systemPrompt": "你是一个技术专家，负责提供技术排查步骤。"}},
  {"id": "out", "type": "output", "data": {"label": "最终回复", "inputMappings": {"mode": "select", "sources": [{"type": "variable", "value": "{{退款处理.response}}"}, {"type": "variable", "value": "{{技术支持.response}}"}]}}}
], "edges": [
  {"source": "in", "target": "llm"}, 
  {"source": "llm", "target": "br_refund"}, 
  {"source": "br_refund", "target": "op_refund", "sourceHandle": "true"}, 
  {"source": "br_refund", "target": "op_tech", "sourceHandle": "false"},
  {"source": "op_refund", "target": "out"}, 
  {"source": "op_tech", "target": "out"}
]}
\`\`\`
`;

export const FULL_EXAMPLES = FLOW_EXAMPLES + "\n\n" + NEGATIVE_EXAMPLES;
