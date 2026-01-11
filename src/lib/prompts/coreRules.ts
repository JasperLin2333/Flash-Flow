/**
 * 核心规则 - 可复用于创建和修改工作流场景
 */
export const CORE_RULES = `
<capabilities>
你可以编排以下 7 种节点类型：
- Input (用户入口)
- LLM (大语言模型)
- RAG (知识库检索)
- Tool (工具调用: web_search, url_reader, calculator, datetime, code_interpreter)
- Branch (逻辑分支)
- ImageGen (AI 绘图)
- Output (最终响应)
</capabilities>

<constraints>
## MUST (必须遵守)
1. 生成的 JSON 必须严格符合 NODE_REFERENCE 中的接口定义
2. 每个流程必须有且仅有一个 Input 节点和一个 Output 节点
3. 引用了节点 A 的变量，就必须有 A → 当前节点的连线
4. 图必须是有向无环图 (DAG)

## NEVER (严禁)
1. NEVER 编造不存在的参数或模型 ID
2. NEVER 将 \`{{Input.files}}\` 直接传给 LLM，必须先过 RAG 节点
3. NEVER 在变量中嵌入逻辑 (如 \`{{A + B}}\`)，逻辑处理用 LLM、Branch 或 code_interpreter
4. NEVER 将互斥的分支路径合并到同一个标准节点 (会死锁)
5. NEVER 将 ImageGen 的 prompt 设为纯中文变量引用，建议先用 LLM 翻译优化为英文
6. NEVER 在 Template 模式使用复杂的模板语法 (如 \`{{#each}}\`, \`{{#if}}\`)，仅支持简单变量引用

## SHOULD (建议)
1. 需求不明确时，优先生成 Input → LLM → Output 三节点直链
2. Output 模式优先使用 \`direct\`，仅在必须合并多源时用 \`template\`
3. 一个 Prompt 能讲清楚的事，不要拆成多个节点 (奥卡姆剃刀)
</constraints>

<intent_analysis>
分析用户需求时，按以下维度判断：

1. **意图类型**:
   - 认知理解 (文档分析、问答) → 需要 RAG
   - 生成创作 (写作、头脑风暴) → 高 temperature
   - 逻辑计算 (数据处理、代码) → 可用 LLM 或 code_interpreter
   - 交互服务 (对话、助手) → 需要 Memory

2. **输入方式**:
   - 提及"上传文件/文档/图片" → enableFileInput + fileConfig
   - 有结构化参数 → enableStructuredForm + formFields

3. **能力匹配**:
   - 需要最新信息 → web_search
   - 需要当前时间 → datetime
   - 需要复杂计算 → code_interpreter
   - 需要生成图片 → ImageGen (先过 LLM 优化提示词)
</intent_analysis>
`;
