## 1. 数据库模型补齐 (MCP 操作)
使用 MCP 执行 SQL，向 `llm_models` 表中补充以下缺失的模型：
- **官方 DeepSeek V3**: `model_id: "deepseek-chat"`, `provider: "deepseek"`, `model_name: "DeepSeek-V3 (官方)"`
- **官方 DeepSeek R1**: `model_id: "deepseek-reasoner"`, `provider: "deepseek"`, `model_name: "DeepSeek-R1 (官方)"`
- **备用 Gemini 3 Pro**: `model_id: "gemini-3-pro-preview"`, `provider: "google"`, `model_name: "Gemini-3-Pro"`

## 2. 环境变量审核 (.env.local)
经检查，您的环境变量配置基本正确：
- `DEFAULT_LLM_MODEL` 已设置为 `deepseek-v3-2-251201` (火山引擎 ID)，作为全局首选。
- `DEEPSEEK_API_KEY` 已正确配置为官方 Key。
- `DOUBAO_API_KEY` 已正确配置为火山 Key。
- `CLASSIFY_MODEL` 也已同步为火山模型。

## 3. AI 生成逻辑审核 (Plan Route)
已审视 `src/app/api/plan/route.ts` 和 `src/app/api/agent/plan/route.ts`：
- **首选模型**：代码均通过 `DEFAULT_LLM_MODEL` 优先调用 **火山 DeepSeek V3.2**。
- **兜底策略**：已配置为 `[火山 DeepSeek] -> [官方 DeepSeek (deepseek-chat)] -> [Gemini 3 Pro]` 的三级降级链路，确保了生成的极高可用性。

## 4. 验证与交付
- 执行 SQL 后，刷新页面确认模型选择器中出现了新模型。
- 确认 `llmProvider.ts` 中的前缀匹配逻辑能正确区分“火山”和“官方”渠道。