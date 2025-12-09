<p align="center">
  <img src="src/app/Logo.png" alt="Flash Flow Logo" width="160" height="160">
</p>

<h1 align="center">⚡ Flash Flow</h1>

<p align="center">
  <strong>说出来，就做出来 —— AI 工作流，30秒搞定</strong>
</p>

<p align="center">
  <a href="#-核心亮点">核心亮点</a> •
  <a href="#-节点能力">节点能力</a> •
  <a href="#-变量引用">变量引用</a> •
  <a href="#-快速开始">快速开始</a>
</p>

<p align="center">
  <a href="https://flash-flow-gray.vercel.app/">
    <img src="https://img.shields.io/badge/🚀_立即体验-Flash_Flow-blue?style=for-the-badge" alt="Try Flash Flow">
  </a>
</p>

---

## 💡 什么是 Flash Flow？

> **一句话描述你的需求，AI 帮你生成完整工作流。**

无需拖拽、无需配置、无需编程 —— 只需 **30秒**，从想法到落地。

```
"帮我做一个文档问答工具，用户上传PDF后可以提问"
```

↓ ↓ ↓ **AI 自动生成** ↓ ↓ ↓

```
📥 输入节点(文件上传) → 📖 RAG检索 → 🧠 LLM回答 → 📤 结果输出
```

---

## 🎯 核心亮点

<table>
<tr>
<td align="center" width="20%">

### 🗣️
**口喷工作流**

用嘴说，用 AI 造
一句话生成完整工作流

</td>
<td align="center" width="20%">

### 🎯
**精准生成**

节点自动连接
参数自动填充

</td>
<td align="center" width="20%">

### 🔗
**引用白痴化**

`{{节点.字段}}`
点击即插入

</td>
<td align="center" width="20%">

### ⚡
**30秒一个流**

描述 → 生成
预览 → 发布

</td>
<td align="center" width="20%">

### 🧩
**编排极简**

拖拽连线
所见即所得

</td>
</tr>
</table>

---

## � 节点能力

### 📥 输入节点 — 三模式自由组合

| 模式 | 说明 | 输出变量 |
|:---:|:---|:---|
| **文本** | 用户自由输入 | `{{节点名.user_input}}` |
| **文件** | 支持 PDF/Word/图片等 | `{{节点名.files[0].url}}` |
| **表单** | 下拉单选/多选/文本框 | `{{节点名.formData.字段名}}` |

---

### 🧠 LLM 节点 — 多模型 + 记忆

| 能力 | 说明 |
|:---:|:---|
| **多模型** | Qwen / GPT / Gemini / Doubao 一键切换 |
| **变量注入** | Prompt 中 `{{变量}}` 自动替换 |
| **对话记忆** | 可配置 1-20 轮记忆，支持多轮上下文 |
| **流式输出** | 打字机效果，实时响应 |

---

### 📖 RAG 节点 — 双模式检索

| 模式 | 场景 | 配置 |
|:---:|:---|:---|
| **静态** | 固定知识库问答 | Builder 预上传文档 |
| **动态** | 用户上传即查询 | 引用 `{{输入节点.files}}` |

> 📌 动态模式使用 Gemini 多模态 API，**秒级响应**

---

### 🔧 工具节点 — 5 种即插即用

| 工具 | 功能 | 参数示例 |
|:---:|:---|:---|
| 🌐 **网页搜索** | Tavily 实时搜索 | `query: {{user_input}}` |
| 🧮 **计算器** | 数学表达式计算 | `expression: "2+2*3"` |
| � **日期时间** | 获取/格式化/计算 | `format: "YYYY-MM-DD"` |
| ⛅ **天气查询** | 和风天气实时数据 | `city: "北京"` |
| 🌐 **网页读取** | 提取网页正文 | `url: "https://..."` |

---

### 🔀 分支节点 — 安全表达式

支持白名单表达式，**防注入攻击**：

```javascript
// 字符串判断
用户输入.user_input.includes('咨询')

// 数值比较
计算结果.result > 60

// 等值判断
状态检查.type === 'VIP'
```

---

### 📤 输出节点 — 四种模式

| 模式 | 场景 | 配置示例 |
|:---:|:---|:---|
| `direct` | 单一来源 | `{{LLM.response}}` |
| `select` | 分支择优 | 取第一个非空结果 |
| `merge` | 多源合并 | 摘要 + 详情组合 |
| `template` | 自定义模板 | `## 问题\n{{user_input}}` |

---

## 🔗 变量引用

### 三种格式，随心选择

| 格式 | 示例 | 说明 |
|:---:|:---|:---|
| **字段名** | `{{user_input}}` | 自动匹配上游 |
| **节点.字段** | `{{用户输入.user_input}}` | 指定节点（推荐） |
| **嵌套访问** | `{{输入.formData.stock}}` | 表单字段 |
| **数组索引** | `{{输入.files[0].url}}` | 文件属性 |

### 点击即插入

参数面板显示所有可用变量，**一键复制**，告别手写。

---

## 🚀 典型场景

| 场景 | 一句话需求 | 耗时 |
|:---:|:---|:---:|
| 📊 **智能报告** | "输入主题，搜索资料生成分析报告" | 30s |
| 📝 **文档问答** | "上传文档，基于内容智能问答" | 20s |
| 🔀 **智能分流** | "根据用户意图路由到不同处理" | 40s |
| 📰 **资讯摘要** | "输入URL，提取正文并生成摘要" | 25s |
| ⛅ **天气播报** | "输入城市，查询天气生成播报" | 15s |

---

### 🎬 案例展示：金融危机应对工作流

> **一句话生成复杂工作流，看看 Flash Flow 的真实表现**

<details>
<summary><b>📝 生成提示词（点击展开）</b></summary>

```
请构建一个非常复杂的金融危机应对工作流。
用户输入股票代码并上传财报，同时填写当前持仓金额。
工作流同时进行联网搜索新闻和 RAG 分析上传的财报。
用一个 LLM 汇总信息并输出 JSON 格式的风险评分（0-100）。
使用 Branch 节点判断：如果分 >80，检索静态知识库中的危机 SOP 并生成公关稿；
如果分 <=80，调用计算器工具计算加仓 20% 后的金额，并生成交易日报。
最后输出一份包含时间戳、风险评估和最终策略（公关稿或交易建议）的综合报告，并附带原始财报文件。
```

</details>

**🖼️ 生成效果**

| ![首页](image.png) | ![首页-左侧栏](image-1.png) |
|:---:|:---:|
| 首页 | 首页-左侧栏 |

| ![Flow Box](image-2.png) | ![工作流编排页面](image-3.png) |
|:---:|:---:|
| Flow Box | 工作流编排页面 |

| ![预览&APP页面](image-4.png) | ![节点配置效果](image-5.png) |
|:---:|:---:|
| 预览&APP页面 | 节点配置效果 |

---

## 🛠️ 技术栈

| 层级 | 技术选型 |
|:---:|:---|
| **前端** | Next.js 16 · React 19 · Zustand · XYFlow |
| **UI** | Radix UI · Tailwind CSS · Framer Motion |
| **后端** | Supabase (PostgreSQL · Auth · Storage) |
| **AI** | OpenAI · Google GenAI · Qwen · Doubao |

---

## 🚀 快速开始

### 1️⃣ 克隆 & 安装

```bash
git clone https://github.com/JasperLin2333/Flash-Flow.git
cd flash-flow && npm install
```

### 2️⃣ 配置环境

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_GENAI_API_KEY=your_google_api_key
TAVILY_API_KEY=your_tavily_api_key
QWEATHER_API_KEY=your_qweather_api_key  # 可选，天气功能
```

### 3️⃣ 启动服务

```bash
npm run dev
```

访问 **[localhost:3000](http://localhost:3000)** 开始使用

---

## 🔒 安全保障

| 机制 | 说明 |
|:---:|:---|
| ✅ **循环检测** | 执行前 DFS 校验，防无限循环 |
| ✅ **并发控制** | 执行锁防重复，配额不多扣 |
| ✅ **参数验证** | Zod Schema 强类型校验 |
| ✅ **表达式白名单** | Branch 节点防代码注入 |
| ✅ **数据隔离** | Row Level Security 保障 |

---

## 📜 开源协议

[MIT License](LICENSE) —— 自由使用，欢迎贡献

---

<p align="center">
  <strong>⚡ Flash Flow —— 让 AI 工作流回归简单</strong>
</p>

<p align="center">
  <a href="https://flash-flow-gray.vercel.app/">
    <img src="https://img.shields.io/badge/🚀_立即体验-Flash_Flow-blue?style=for-the-badge" alt="Try Flash Flow">
  </a>
</p>

---

<p align="center">
  <sub>Made with ❤️ by Flash Flow Team · <a href="https://flash-flow-gray.vercel.app/">🚀 立即体验</a></sub>
</p>