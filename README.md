<p align="center">
  <img src="src/app/Logo.png" alt="Flash Flow Logo" width="120" height="120">
</p>

<h1 align="center">Flash Flow</h1>

<p align="center">
  <strong>🚀 可视化 AI 工作流编排平台</strong>
</p>

<p align="center">
  <a href="#功能特点">功能特点</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#节点类型">节点类型</a> •
  <a href="#项目结构">项目结构</a>
</p>

---

## ✨ 项目简介

Flash Flow 是一个现代化的 **可视化 AI 工作流编排平台**，让您无需编写代码即可构建复杂的 AI 应用。通过直观的拖拽式界面，您可以轻松连接 LLM、RAG 知识库、外部工具等组件，创建强大的自动化工作流。

**想要什么，就做什么** —— 这是 Flash Flow 的核心理念。

## 🎯 功能特点

### 💡 智能工作流构建
- **可视化编排**：基于 XYFlow 的拖拽式节点编辑器
- **自然语言生成**：输入需求描述，AI 自动生成工作流
- **实时预览**：边构建边测试，即时查看执行效果

### 🤖 强大的 AI 能力
- **多模型支持**：接入 Qwen、OpenAI、Google Gemini 等主流 LLM
- **对话记忆**：支持多轮对话上下文，智能记忆管理
- **流式输出**：打字机效果的实时响应展示

### 📚 知识库集成
- **RAG 检索增强**：基于 Gemini File Search API 的语义检索
- **多格式支持**：PDF、Word、Markdown、TXT 等文档格式
- **智能分块**：可配置的文档分块与重叠策略

### 🛠️ 丰富的工具生态
- **网页搜索**：集成 Tavily API 实时搜索
- **数学计算**：内置表达式计算器
- **条件分支**：灵活的流程控制与路由

### 🔐 企业级特性
- **用户认证**：基于 Supabase Auth 的安全认证
- **配额管理**：细粒度的用户使用量控制
- **数据隔离**：Row Level Security 保障数据安全

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | Next.js 16, React 19 |
| **状态管理** | Zustand |
| **流程编辑器** | XYFlow (React Flow) |
| **UI 组件** | Radix UI, Tailwind CSS |
| **后端服务** | Supabase (PostgreSQL, Auth, Storage) |
| **AI 集成** | OpenAI SDK, Google GenAI, LangChain |
| **表单验证** | React Hook Form, Zod |
| **动画效果** | Framer Motion |

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm
- Supabase 账户

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/JasperLin2333/Flash-Flow.git
cd flash-flow
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**

创建 `.env.local` 文件，填入以下配置：
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# LLM API Keys
OPENAI_API_KEY=your_openai_api_key
GOOGLE_GENAI_API_KEY=your_google_api_key

# 工具 API
TAVILY_API_KEY=your_tavily_api_key
```

4. **初始化数据库**

在 Supabase 控制台执行 `supabase-schema.sql` 中的 SQL 语句

5. **启动开发服务器**
```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 开始使用

## 📦 节点类型

Flash Flow 提供 6 种核心节点类型：

### 🔤 Input 节点（输入节点）
用户输入的入口，支持：
- 文本输入
- 文件上传（图片、文档、表格等）
- 结构化表单（文本框、下拉单选/多选）

### 🧠 LLM 节点（大语言模型节点）
调用大语言模型生成内容：
- 可选多种模型（Qwen、GPT、Gemini 等）
- 支持变量引用 `{{variable_name}}`
- 可配置温度、记忆轮数

### 📖 RAG 节点（检索增强生成节点）
基于知识库的智能检索：
- 上传文档自动创建向量索引
- 可配置分块大小与 Top-K

### 🔧 Tool 节点（工具节点）
调用外部工具执行任务：
- `web_search`：网页搜索
- `calculator`：数学表达式计算

### 🔀 Branch 节点（分支节点）
条件控制流程走向：
- 支持字符串匹配、数值比较
- TRUE/FALSE 双路径输出

### 📤 Output 节点（输出节点）
工作流的终点，展示最终结果

## 📁 项目结构

```
flash-flow/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   ├── app/               # 应用运行页面
│   │   ├── builder/           # 工作流构建器
│   │   └── flows/             # 流程管理页面
│   ├── components/
│   │   ├── auth/              # 认证相关组件
│   │   ├── builder/           # 构建器组件
│   │   ├── flow/              # 流程编辑器组件
│   │   ├── run/               # 运行时组件
│   │   └── ui/                # 通用 UI 组件
│   ├── services/              # API 服务层
│   ├── store/                 # Zustand 状态管理
│   │   ├── actions/           # 状态操作
│   │   ├── executors/         # 节点执行器
│   │   └── utils/             # 工具函数
│   └── types/                 # TypeScript 类型定义
├── supabase-schema.sql        # 数据库模式
└── package.json
```

## 🗄️ 数据库结构

| 表名 | 用途 |
|------|------|
| `flows` | 工作流定义存储 |
| `chat_history` | 聊天历史记录 |
| `flow_executions` | 执行日志 |
| `llm_models` | LLM 模型配置 |
| `llm_node_memory` | LLM 对话记忆 |
| `users_quota` | 用户配额管理 |
| `user_profiles` | 用户档案 |
| `file_uploads` | 文件上传记录 |
| `knowledge_files` | 知识库文件 |

## 🔒 安全特性

- **循环依赖检测**：执行前 DFS 检测，防止无限循环
- **并发控制**：执行锁机制防止重复执行
- **参数验证**：基于 Zod Schema 的类型安全验证
- **表达式白名单**：Branch 节点仅支持安全表达式
- **Row Level Security**：Supabase RLS 确保数据隔离

## 📜 开源协议

本项目采用 [MIT License](LICENSE) 开源协议

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

<p align="center">
  Made with ❤️ by Flash Flow Team
</p>

试用地址：https://flash-flow-gray.vercel.app/

![alt text](image.png)

![alt text](image-1.png)

![alt text](image-2.png)