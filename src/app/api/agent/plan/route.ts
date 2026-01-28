import OpenAI from "openai";
export const runtime = 'edge';

import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from "@/lib/quotaEdge";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { CORE_RULES, NODE_REFERENCE, VARIABLE_RULES, EDGE_RULES, FLOW_EXAMPLES, NEGATIVE_EXAMPLES } from "@/lib/prompts";
import { WorkflowZodSchema } from "@/lib/schemas/workflow";
import { detectIntentFromPrompt, getProactiveSuggestions, BEST_PRACTICES } from "@/lib/agent/bestPractices";
import { extractBalancedJson, validateWorkflow } from "@/lib/agent/utils";
import type { AppNode, AppEdge } from "@/types/flow";

// ============ Agent Configuration ============
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL || "deepseek-v3.2";
const MAX_RETRIES = 5; // Phase 2: Allow more self-correction rounds
const PLAN_MAX_RETRIES = 2;
const TIMEOUT_ANALYSIS_MS = 25000;
const TIMEOUT_GENERATION_MS = 45000;

// ============ Agent System Prompt (Modular) ============

// Phase 1: Deep Analysis - Three-phase reasoning framework
const ANALYSIS_ONLY_PROMPT = `你是 Flash Flow Agent，一个专业的工作流设计AI。你的任务是**深度理解**用户需求，而不是简单复述。

## 🧠 核心原则
1. **不要复述** - 用户说的话他们自己知道，你要挖掘他们没说的
2. **主动推理** - 根据上下文推导隐含意图和约束
3. **发现盲点** - 识别用户可能遗漏的边界情况
4. **用户视角** - 规划必须用**用户听得懂的语言**描述

## 📋 输出格式
请按顺序输出两个部分：深度分析 和 任务规划。

### 第一部分：深度分析
<step type="analysis">
**核心意图推理:**
- 使用场景：${'{这个工作流会在什么情况下被调用？}'}
- 输入来源：${'{数据从哪来？}'}
- 输出期望：${'{结果给谁？}'}

**隐含假设与预警:**
- ${'{假设与边界情况}'}

**关键设计决策:**
- ${'{理由}'}
</step>

### 第二部分：任务规划（面向用户）
<plan>
## 需求理解
${'{直接一句话描述核心目标，禁止使用"我理解"、"用户想要"等前缀}'}

## 工作流结构
- [type:input] 输入节点：${'{简述功能}'}
- [type:llm] ${'{核心节点名}'}：${'{简述功能}'}
- [type:output] 输出节点：${'{简述功能}'}

## 适用场景
- ${'{场景1}'}
- ${'{场景2}'}
- ${'{场景3}'}

## 使用方法
1. ${'{步骤1}'}
2. ${'{步骤2}'}
3. ${'{步骤3}'}
</plan>

## ⚡️ 规则
- 必须包含 <plan> 标签
- <plan> 内容由用户阅读，**严禁**使用技术术语（如"JSON参数"），要说人话
- **不要**提及"下一步"
- 节点必须带 [type:xxx] 标记，支持: input, llm, rag, tool, imagegen, branch, output
`;

// Phase 2: Generation - With analysis context, do strategy/reflection/JSON
const GENERATION_PROMPT = `你是 Flash Flow Agent，一个专业的工作流设计AI。

## 🎯 任务
根据已完成的需求分析，设计并生成工作流。

## 🧠 执行流程
用户已确认需求分析，现在请执行以下步骤：

### 步骤 1：深度架构规划
<step type="strategy">
你不仅是执行者，更是**系统架构师**。请按以下维度制定技术方案：

1. **架构模式选择**:
   - 针对此需求，采用哪种设计模式？(如: 简单的线性处理 / RAG 检索增强 / 复杂的分支判断 / 多步工具调用)
   - *理由*: 为什么这个模式最适合？

2. **关键节点推演**:
   - 核心节点 1: [类型+功能] -> [配置理由: 为什么选这个模型/参数？]
   - 核心节点 2: ...
   - *注意*: 必须确保每个节点都有明确的输入来源。

3. **数据流拓扑**:
   - 模拟数据流向: Input.user_input -> NodeA -> NodeB -> Output
   - *检查*: 是否存在"断头"数据（有产出无引用）或"悬空"引用（引用了不存在的变量）？

4. **防御性设计**:
   - 如果上游节点失败或返回空值，下游该如何处理？(是否需要默认值或分支？)
</step>

### 步骤 2：深度逻辑审查
<step type="reflection">
现在，请扮演**首席代码审查员**，对上述“架构规划”进行无情的批判与优化：

1. **奥卡姆剃刀检查**:
   - 能否删减不必要的节点？(例如：能用正则提取的不要用 LLM)
   - 现在的设计是不是最简路径？

2. **Prompt 质量审计**:
   - LLM 节点的 System Prompt 是否包含了角色定义(Persona)？
   - 是否给出了足够的上下文(Context)？

3. **隐患排查**:
   - ⚠️ 最大的失败风险点在哪里？（如：RAG 检索不到内容怎么办？）
   - *修正方案*: 我将增加...配置来规避此风险。

4. **最终决策**:
   - 基于以上审查，我将对方案做出的具体修正...
</step>

### 步骤 3：合规性自查
<step type="verification">
请对照以下核心规则，逐项检查你的设计方案。如有违反，必须在下一步中修正：

1. **依赖检查**: 每一个变量引用 (如 {{A.res}}) 是否都对应一条 A -> Current 的连线？
2. **分支检查**: Branch 节点是否正确配置了 \`sourceHandle: "true"\` 和 \`"false"\`？
3. **输出检查**: Output 节点是否在汇聚多分支？是否严禁了 Handlebars 逻辑？
4. **安全检查**: 是否存在将 \`{{Input.files}}\` 直接传给 LLM 的违规行为？
5. **拓扑检查**: 是否存在自环或循环依赖？
</step>

### 步骤 4：优化实施
<step type="modified_plan">
作为技术负责人，请根据上述自查结果，确认最终的实施方案。不要复述废话，直接列出变动点：

1. **修正执行记录**:
   - [保留/删除/新增] 节点X: *原因...*
   - [优化] 节点Y: *增加了...配置*

2. **最终架构蓝图**:
   - 确认最终的节点调用链 (Input -> ... -> Output)
   - *确认*: 这就是即将写入 JSON 的最终版本。
</step>

### 步骤 5：生成 JSON
\`\`\`json
{"title": "工作流标题", "nodes": [...], "edges": [...]}
\`\`\`

## ⚡️ 规则
- 严格按顺序执行步骤 1 → 2 → 3 → 4 → 5
- 每个步骤使用对应的 <step type="xxx"> 标签
- 最后输出合法 JSON

${CORE_RULES}

${NODE_REFERENCE}

${VARIABLE_RULES}

${EDGE_RULES}

${FLOW_EXAMPLES}

${NEGATIVE_EXAMPLES}`;

// Direct mode (no confirmation needed) - 4-step flow with deep reasoning
const DIRECT_MODE_PROMPT = `你是 Flash Flow Agent，一个专业的工作流设计AI。你的任务是**深度理解**用户需求，而不是简单复述。

## 🧠 核心原则
1. **不要复述** - 用户说的话他们自己知道，你要挖掘他们没说的
2. **主动推理** - 根据上下文推导隐含意图和约束
3. **发现盲点** - 识别用户可能遗漏的边界情况
4. **给出理由** - 每个设计决策都要说明"为什么"

## 🎯 核心使命
根据用户的自然语言需求，设计并生成符合规范的工作流 JSON。

## 🧠 执行流程
你必须按照以下顺序执行，使用 XML 标签结构化输出：

### 步骤 1：深度需求分析
<step type="analysis">
**用户需求理解:** 用户想要${'{描述核心目标，不是复述原话}'}

**深层意图推理:**
- 使用场景：${'{这个工作流会在什么情况下被调用？}'}
- 输入来源：${'{数据从哪来？可能有什么问题？}'}
- 输出期望：${'{结果给谁？什么格式？}'}

**隐含假设:** ${'{用户没说但暗示了什么？}'}
**潜在问题:** ${'{边界情况：空输入/超长/格式错误怎么办？}'}
**所需节点:** ${'{根据分析列出节点}'}
</step>

### 步骤 2：深度架构规划
<step type="strategy">
你不仅是执行者，更是**系统架构师**。请按以下维度制定技术方案：

1. **架构模式选择**:
   - 针对此需求，采用哪种设计模式？(如: 简单的线性处理 / RAG 检索增强 / 复杂的分支判断 / 多步工具调用)
   - *理由*: 为什么这个模式最适合？

2. **关键节点推演**:
   - 核心节点 1: [类型+功能] -> [配置理由: 为什么选这个模型/参数？]
   - 核心节点 2: ...
   - *注意*: 必须确保每个节点都有明确的输入来源。

3. **数据流拓扑**:
   - 模拟数据流向: Input.user_input -> NodeA -> NodeB -> Output
   - *检查*: 是否存在"断头"数据（有产出无引用）或"悬空"引用（引用了不存在的变量）？

4. **防御性设计**:
   - 如果上游节点失败或返回空值，下游该如何处理？(是否需要默认值或分支？)
</step>

### 步骤 3：深度逻辑审查
<step type="reflection">
现在，请扮演**首席代码审查员**，对上述“架构规划”进行无情的批判与优化：

1. **奥卡姆剃刀检查**:
   - 能否删减不必要的节点？(例如：能用正则提取的不要用 LLM)
   - 现在的设计是不是最简路径？

2. **Prompt 质量审计**:
   - LLM 节点的 System Prompt 是否包含了角色定义(Persona)？
   - 是否给出了足够的上下文(Context)？

3. **隐患排查**:
   - ⚠️ 最大的失败风险点在哪里？（如：RAG 检索不到内容怎么办？）
   - *修正方案*: 我将增加...配置来规避此风险。

4. **最终决策**:
   - 基于以上审查，我将对方案做出的具体修正...
</step>

### 步骤 4：合规性自查
<step type="verification">
请对照以下核心规则，逐项检查你的设计方案。如有违反，必须在下一步中修正：

1. **依赖检查**: 每一个变量引用 (如 {{A.res}}) 是否都对应一条 A -> Current 的连线？
2. **分支检查**: Branch 节点是否正确配置了 \`sourceHandle: "true"\` 和 \`"false"\`？
3. **输出检查**: Output 节点是否在汇聚多分支？是否严禁了 Handlebars 逻辑？
4. **安全检查**: 是否存在将 \`{{Input.files}}\` 直接传给 LLM 的违规行为？
5. **拓扑检查**: 是否存在自环或循环依赖？
</step>

### 步骤 5：优化实施
<step type="modified_plan">
作为技术负责人，请根据上述自查结果，确认最终的实施方案。不要复述废话，直接列出变动点：

1. **修正执行记录**:
   - [保留/删除/新增] 节点X: *原因...*
   - [优化] 节点Y: *增加了...配置*

2. **最终架构蓝图**:
   - 确认最终的节点调用链 (Input -> ... -> Output)
   - *确认*: 这就是即将写入 JSON 的最终版本。
</step>

### 步骤 6：生成 JSON
在所有 step 标签结束后，输出最终的工作流 JSON：
\`\`\`json
{"title": "工作流标题", "nodes": [...], "edges": [...]}
\`\`\`

## ⚡️ 规则
- 严格按顺序执行步骤 1 → 2 → 3 → 4 → 5 → 6
- 每个步骤使用对应的 <step type="xxx"> 标签
- 最后输出合法 JSON

${CORE_RULES}

${NODE_REFERENCE}

${VARIABLE_RULES}

${EDGE_RULES}

${FLOW_EXAMPLES}

${NEGATIVE_EXAMPLES}`;

// Legacy constant for backward compatibility
const AGENT_SYSTEM_PROMPT = DIRECT_MODE_PROMPT;




// ============ Main Handler ============
export async function POST(req: Request) {
    const reqClone = req.clone();

    try {
        // Authentication check
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return unauthorizedResponse();
        }

        // Server-side quota check
        const pointsCheck = await checkPointsOnServer(req, user.id, "flow_generation");
        if (!pointsCheck.allowed) {
            return pointsExceededResponse(pointsCheck.balance, pointsCheck.required);
        }

        const body = await reqClone.json();
        const { prompt, enableClarification } = body;

        if (!prompt?.trim()) {
            return new Response(
                JSON.stringify({ nodes: [], edges: [] }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        // Get model and provider
        const modelName = DEFAULT_MODEL;
        const provider = getProviderForModel(modelName);
        const config = PROVIDER_CONFIG[provider];

        const client = new OpenAI({
            apiKey: config.getApiKey(),
            baseURL: config.baseURL,
        });

        // Create streaming response
        const encoder = new TextEncoder();
        let accumulatedText = "";
        let thinkingEmitted = false;
        let suggestionEmitted = false;

        const stream = new ReadableStream({
            async start(controller) {
                let success = false;
                let lastError: string | null = null;
                let validationAttempt = 0;
                let planAttempt = 0;
                let fallbackToDirect = false;

                // Detect Plan Confirmation
                const isPlanConfirmed = prompt.includes("[PLAN_CONFIRMED]");
                const effectivePrompt = isPlanConfirmed ? prompt.replace("[PLAN_CONFIRMED]", "").trim() : prompt;

                // ============ DETERMINISTIC TWO-PHASE FLOW ============
                // Instead of relying on LLM to "stop at the right place",
                // we use completely different prompts for each phase.

                let systemPrompt: string;
                let isAnalysisPhase = false;

                if (isPlanConfirmed) {
                    // Phase 2: User confirmed plan, do strategy → reflection → JSON
                    // Extract analysis context from the prompt (it should be included)
                    systemPrompt = GENERATION_PROMPT;
                } else if (enableClarification) {
                    // Phase 1: ONLY do analysis, LLM doesn't even know about other steps
                    systemPrompt = ANALYSIS_ONLY_PROMPT;
                    isAnalysisPhase = true;
                } else {
                    // Direct mode: no confirmation needed, full 4-step flow
                    systemPrompt = DIRECT_MODE_PROMPT;
                }

                let messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `请根据以下需求设计工作流:\n\n${effectivePrompt}` },
                ];

                while (!success && validationAttempt < MAX_RETRIES) {
                    try {
                        // Create timeout signal for this generation attempt
                        const abortController = new AbortController();
                        const timeoutMs = isAnalysisPhase ? TIMEOUT_ANALYSIS_MS : TIMEOUT_GENERATION_MS;
                        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

                        const completion = await client.chat.completions.create({
                            model: modelName,
                            temperature: isPlanConfirmed ? 0.2 : 0.4, // Higher temp for planning/analysis
                            messages,
                            stream: true,
                            // Note: JSON mode removed to allow <thinking> and other XML tags
                        }, { signal: abortController.signal });

                        accumulatedText = "";

                        let processedStepCount = 0; // Track which steps we have fully finalized

                        for await (const chunk of completion) {
                            const content = chunk.choices?.[0]?.delta?.content || "";
                            if (content) {
                                accumulatedText += content;

                                // Phase 2: Detect Clarification Tags
                                // First, strip out EXAMPLE blocks to avoid matching the System Prompt example
                                const textWithoutExamples = accumulatedText.replace(/\[EXAMPLE_START\][\s\S]*?\[EXAMPLE_END\]/g, '');
                                const clarificationMatch = textWithoutExamples.match(/<clarification>([\s\S]*?)<\/clarification>/);
                                if (clarificationMatch) {
                                    const questionsText = clarificationMatch[1].trim();
                                    const questions = questionsText
                                        .split(/\n/)
                                        .map(q => q.replace(/^\d+\.\s*/, '').trim())
                                        .filter(q => {
                                            // Filter out non-question lines
                                            if (q.length < 5) return false;
                                            // Exclude lines containing XML tags
                                            if (/<[^>]+>/.test(q)) return false;
                                            // Exclude metadata/markers
                                            if (q.startsWith('[') || q.includes('EXAMPLE')) return false;
                                            // Exclude empty or whitespace-only
                                            if (!q.trim()) return false;
                                            return true;
                                        })
                                        // Limit to max 5 questions to avoid overwhelming UI
                                        .slice(0, 5);

                                    // Only emit clarification if we have valid questions
                                    if (questions.length > 0) {
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({
                                                type: "clarification",
                                                questions: questions
                                            })}\n\n`)
                                        );

                                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                                        controller.close();
                                        return; // Stop checking further
                                    }
                                }

                                // Phase 2b: Detect Plan Tag
                                // Pattern: <plan> ... </plan>
                                // First, strip out PLAN_EXAMPLE blocks to avoid matching the System Prompt example
                                const textWithoutPlanExamples = accumulatedText.replace(/\[PLAN_EXAMPLE_START\][\s\S]*?\[PLAN_EXAMPLE_END\]/g, '');
                                const planMatch = textWithoutPlanExamples.match(/<plan>([\s\S]*?)<\/plan>/);
                                if (planMatch) {
                                    // 🔍 Debug Logging: Track interruption timing
                                    const stepCount = (accumulatedText.match(/<step type="/g) || []).length;
                                    const hasAnalysis = accumulatedText.includes('type="analysis"');
                                    const hasStrategy = accumulatedText.includes('type="strategy"');
                                    const hasReflection = accumulatedText.includes('type="reflection"');

                                    console.log('[Agent Plan] Plan detected:', {
                                        position: planMatch.index,
                                        totalLength: accumulatedText.length,
                                        stepsCompleted: stepCount,
                                        afterAnalysis: hasAnalysis,
                                        hasStrategy,
                                        hasReflection,
                                        timestamp: new Date().toISOString()
                                    });

                                    const planContent = planMatch[1].trim();

                                    // Parse new structured plan sections
                                    const refinedIntentMatch = planContent.match(/## 需求理解\n([\s\S]*?)(?=\n##|$)/);
                                    const refinedIntent = refinedIntentMatch ? refinedIntentMatch[1].trim() : "";

                                    const nodesMatch = planContent.match(/## 工作流结构\n([\s\S]*?)(?=\n##|$)/);
                                    const workflowNodesRaw = nodesMatch ? nodesMatch[1].trim() : "";

                                    const workflowNodes = workflowNodesRaw.split('\n')
                                        .map(line => {
                                            // Match "- [type:xxx] Label: Description"
                                            // Regex: ^[-*]\s*(?:\[type:(\w+)\])?\s*(.*?)[：:]\s*(.*)
                                            const match = line.match(/^[-*]\s*(?:\[type:(\w+)\])?\s*(.*?)[：:]\s*(.*)/);
                                            if (match) {
                                                return {
                                                    type: match[1] || 'default', // Captures 'type' if present
                                                    label: match[2].trim(),
                                                    description: match[3].trim()
                                                };
                                            }
                                            return null;
                                        })
                                        .filter((n): n is { type: string; label: string; description: string } => n !== null);

                                    const useCasesMatch = planContent.match(/## 适用场景\n([\s\S]*?)(?=\n##|$)/);
                                    const useCases = useCasesMatch
                                        ? useCasesMatch[1].split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(l => l.length > 2)
                                        : [];

                                    const howToUseMatch = planContent.match(/## 使用方法\n([\s\S]*?)(?=\n##|$)/);
                                    const howToUse = howToUseMatch
                                        ? howToUseMatch[1].split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(l => l.length > 2)
                                        : [];

                                    // Fallback / Backward Compatibility
                                    const steps = workflowNodes.length > 0
                                        ? workflowNodes.map(n => `${n.label}: ${n.description}`)
                                        : planContent.split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^[-*]\s*/, '').trim());

                                    const userPrompt = refinedIntent || effectivePrompt;

                                    // Emit Plan Event with new fields
                                    controller.enqueue(
                                        encoder.encode(`data: ${JSON.stringify({
                                            type: "plan",
                                            userPrompt: userPrompt,
                                            steps: steps, // Valid for legacy, but UI will prefer new fields
                                            refinedIntent,
                                            workflowNodes,
                                            useCases,
                                            howToUse
                                        })}\n\n`)
                                    );

                                    // STOP generation here to wait for confirmation
                                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                                    controller.close();
                                    return;
                                }



                                // Detect step tags
                                const stepMatches = [...accumulatedText.matchAll(/<step type="([^"]+)">/g)];

                                // 1. Handle "jumped" steps (steps that were skipped or finished in this chunk)
                                // If we have more matches than we've processed + 1 (the active one), implies intermediate steps are done.
                                while (processedStepCount < stepMatches.length - 1) {
                                    const match = stepMatches[processedStepCount];
                                    const nextMatch = stepMatches[processedStepCount + 1];
                                    const stepType = match[1];

                                    // Extract content: from this match end to next match start
                                    // Robustly remove closing tag
                                    let stepContent = accumulatedText.slice(match.index! + match[0].length, nextMatch.index);
                                    const closeTagIndex = stepContent.indexOf("</step>");
                                    if (closeTagIndex !== -1) {
                                        stepContent = stepContent.slice(0, closeTagIndex);
                                    }

                                    controller.enqueue(
                                        encoder.encode(`data: ${JSON.stringify({
                                            type: "step",
                                            stepType: stepType,
                                            status: "completed",
                                            content: stepContent.trim()
                                        })}\n\n`)
                                    );

                                    processedStepCount++;
                                }

                                // 2. Handle the Active Step (The last one found)
                                if (stepMatches.length > 0) {
                                    const lastMatch = stepMatches[stepMatches.length - 1];
                                    const stepType = lastMatch[1];

                                    // Extract content from this step start until end of text
                                    const startIndex = lastMatch.index! + lastMatch[0].length;
                                    let content = accumulatedText.slice(startIndex);

                                    // FIX: Truncate content if <plan> or <clarification> tags appear to prevent leakage
                                    // This ensures we don't emit raw tags as step content while waiting for them to close
                                    const leakMatch = content.match(/<plan>|<clarification>/);
                                    if (leakMatch && leakMatch.index !== undefined) {
                                        content = content.slice(0, leakMatch.index);
                                    }

                                    // Check if it's closed
                                    const closeTag = "</step>";
                                    const closeIndex = content.indexOf(closeTag);
                                    const isClosed = closeIndex !== -1;

                                    if (isClosed) {
                                        content = content.slice(0, closeIndex);
                                        // Only increment if we haven't already counted this one (logic check)
                                        // This handles the case where the closing tag arrives in the SAME chunk as the opening tag
                                        // But we handled 'skipped' steps above. 
                                        // If isClosed is true, this step is effectively done.
                                        // However, we'll let the next chunk (or loop) finalize it via the 'while' loop if a NEW step appears?
                                        // NO, the user wants immediate feedback.

                                        // If closed, emit completed IMMEDIATELY and increment count
                                        // But wait, if we increment count, the 'while' loop won't touch it next time. Correct.
                                        if (processedStepCount === stepMatches.length - 1) {
                                            controller.enqueue(
                                                encoder.encode(`data: ${JSON.stringify({
                                                    type: "step",
                                                    stepType: stepType,
                                                    status: "completed",
                                                    content: content.trim()
                                                })}\n\n`)
                                            );
                                            processedStepCount++;

                                            // [Removed Legacy Forced Interruption Logic - relied on prompt now]
                                        }
                                    } else {
                                        // Still streaming
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({
                                                type: "step",
                                                stepType: stepType,
                                                status: "streaming",
                                                content: content.trim()
                                            })}\n\n`)
                                        );
                                    }
                                }

                                // Send raw progress (still useful for debug or fallback)
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ type: "progress", content })}\n\n`)
                                );
                            }
                        }
                        
                        // Clear timeout as soon as generation is done (or loop finishes)
                        clearTimeout(timeoutId);

                        if (isAnalysisPhase) {
                            const textWithoutPlanExamples = accumulatedText.replace(/\[PLAN_EXAMPLE_START\][\s\S]*?\[PLAN_EXAMPLE_END\]/g, '');
                            const planMatch = textWithoutPlanExamples.match(/<plan>([\s\S]*?)<\/plan>/);
                            if (planMatch) {
                                const planContent = planMatch[1].trim();
                                const refinedIntentMatch = planContent.match(/## 需求理解\n([\s\S]*?)(?=\n##|$)/);
                                const refinedIntent = refinedIntentMatch ? refinedIntentMatch[1].trim() : "";

                                const nodesMatch = planContent.match(/## 工作流结构\n([\s\S]*?)(?=\n##|$)/);
                                const workflowNodesRaw = nodesMatch ? nodesMatch[1].trim() : "";

                                const workflowNodes = workflowNodesRaw.split('\n')
                                    .map(line => {
                                        const match = line.match(/^[-*]\s*(?:\[type:(\w+)\])?\s*(.*?)[：:]\s*(.*)/);
                                        if (match) {
                                            return {
                                                type: match[1] || 'default',
                                                label: match[2].trim(),
                                                description: match[3].trim()
                                            };
                                        }
                                        return null;
                                    })
                                    .filter((n): n is { type: string; label: string; description: string } => n !== null);

                                const useCasesMatch = planContent.match(/## 适用场景\n([\s\S]*?)(?=\n##|$)/);
                                const useCases = useCasesMatch
                                    ? useCasesMatch[1].split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(l => l.length > 2)
                                    : [];

                                const howToUseMatch = planContent.match(/## 使用方法\n([\s\S]*?)(?=\n##|$)/);
                                const howToUse = howToUseMatch
                                    ? howToUseMatch[1].split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(l => l.length > 2)
                                    : [];

                                const steps = workflowNodes.length > 0
                                    ? workflowNodes.map(n => `${n.label}: ${n.description}`)
                                    : planContent.split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^[-*]\s*/, '').trim());

                                const userPrompt = refinedIntent || effectivePrompt;

                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: "plan",
                                        userPrompt: userPrompt,
                                        steps: steps,
                                        refinedIntent,
                                        workflowNodes,
                                        useCases,
                                        howToUse
                                    })}\n\n`)
                                );
                                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                                controller.close();
                                return;
                            }

                            planAttempt++;

                            if (planAttempt < PLAN_MAX_RETRIES && !fallbackToDirect) {
                                messages.push({
                                    role: "user",
                                    content: `请严格只输出 <plan> 标签内的内容，必须包含以下 4 个小节标题：\n## 需求理解\n## 工作流结构\n## 适用场景\n## 使用方法\n不要输出 JSON、<step> 或其他标签。`
                                });
                                lastError = "Plan not generated";
                                validationAttempt++;
                                continue;
                            }

                            if (!fallbackToDirect) {
                                fallbackToDirect = true;
                                isAnalysisPhase = false;
                                systemPrompt = DIRECT_MODE_PROMPT;
                                messages = [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: `请根据以下需求设计工作流:\n\n${effectivePrompt}` },
                                ];
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: "step",
                                        stepType: "fallback",
                                        status: "completed",
                                        content: "规划阶段未产出有效计划，已切换为直接生成流程"
                                    })}\n\n`)
                                );
                                validationAttempt++;
                                continue;
                            }
                        }

                        // Parse and validate result
                        let parsedResult: { title?: string; nodes?: unknown[]; edges?: unknown[] } = {};
                        try {
                            // Clean steps tags to extract JSON
                            let cleanedText = accumulatedText.replace(/<step[\s\S]*?<\/step>/g, "");
                            cleanedText = cleanedText.replace(/<thinking>[\s\S]*?<\/thinking>/g, ""); // Legacy support

                            const jsonMatch = extractBalancedJson(cleanedText);
                            if (jsonMatch) {
                                parsedResult = JSON.parse(jsonMatch);
                            }
                        } catch {
                            lastError = "Failed to parse JSON from response";
                            validationAttempt++;
                            continue;
                        }

                        const nodes = parsedResult.nodes || [];
                        const edges = parsedResult.edges || [];

                        // Emit Drafting Step (Completed)
                        // This visualizes the "Structure Generation" phase
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({
                                type: "step",
                                stepType: "drafting",
                                status: "completed",
                                content: `🎉 工作流结构构建完成！共包含 ${nodes.length} 个核心节点和 ${edges.length} 条逻辑连线。`
                            })}\n\n`)
                        );

                        // Add a small delay for visual pacing
                        await new Promise(r => setTimeout(r, 400));

                        // Validate
                        const validation = validateWorkflow(nodes, edges);

                        // Signal validation start

                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({
                                type: "step",
                                stepType: "validation",
                                status: "streaming",
                                content: "正在进行最终逻辑校验..."
                            })}\n\n`)
                        );

                        // Simulate a small delay for user perception if needed, or just proceed
                        // await new Promise(r => setTimeout(r, 500));

                        if (validation.valid || validation.softPass) {
                            // 显示自动修复详情
                            const warnings = validation.warnings || [];
                            let validationMessage = "逻辑校验通过";
                            if (warnings.length > 0) {
                                // 区分结构修复和变量修复
                                const structureFixes = warnings.filter(w => w.includes('循环') || w.includes('孤岛') || w.includes('边'));
                                const variableFixes = warnings.filter(w => w.includes('Auto-fixed'));
                                const parts = [];
                                if (structureFixes.length > 0) parts.push(`结构优化 ${structureFixes.length} 处`);
                                if (variableFixes.length > 0) parts.push(`变量修正 ${variableFixes.length} 处`);
                                validationMessage = `逻辑校验通过 (${parts.join('，') || `自动修复 ${warnings.length} 处`})`;
                            }

                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "step",
                                    stepType: "validation",
                                    status: "completed",
                                    content: validationMessage
                                })}\n\n`)
                            );

                            await new Promise(r => setTimeout(r, 600)); // Delay for visual pacing

                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "tool-call",
                                    tool: "validate_flow",
                                    args: { nodeCount: (nodes as AppNode[]).length, edgeCount: (edges as AppEdge[]).length }
                                })}\n\n`)
                            );
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "tool-result",
                                    tool: "validate_flow",
                                    result: {
                                        valid: validation.valid,
                                        softPass: validation.softPass,
                                        warnings: validation.valid ? validation.warnings : validation.errors
                                    }
                                })}\n\n`)
                            );

                            await new Promise(r => setTimeout(r, 600)); // Delay for visual pacing

                            // Success or soft pass - Send result with optional warnings
                            // 使用三层自愈后的节点和边
                            const finalNodes = validation.fixedNodes || nodes;
                            const finalEdges = validation.fixedEdges || edges;

                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "result",
                                    title: parsedResult.title || prompt.slice(0, 20),
                                    nodes: finalNodes,
                                    edges: finalEdges,
                                    warnings: validation.valid ? validation.warnings : validation.errors,
                                })}\n\n`)
                            );

                            // Phase 3: Emit proactive suggestions based on intent analysis
                            try {
                                const scenario = detectIntentFromPrompt(prompt);
                                const suggestions = getProactiveSuggestions(scenario);
                                const practice = BEST_PRACTICES[scenario];

                                // Analyze workflow for specific suggestions
                                const nodeTypes = (nodes as AppNode[]).map(n => n.type);
                                const hasImageGen = nodeTypes.includes("imagegen");
                                const hasBranch = nodeTypes.includes("branch");

                                const workflowSuggestions: string[] = [];

                                // Scenario-specific suggestions
                                if (scenario === "翻译" && !hasBranch) {
                                    workflowSuggestions.push("建议添加人工审核节点以保证翻译质量");
                                }

                                if (hasImageGen) {
                                    const imageGenNode = (nodes as AppNode[]).find(n => n.type === "imagegen");
                                    if (imageGenNode && (imageGenNode.data as any)?.negativePrompt === undefined) {
                                         // Note: accessing data.negativePrompt directly requires narrowing, keeping it safe for now or using cast
                                         // Actually AppNode union makes data access tricky without narrowing.
                                         // Let's use 'as any' just for the property check if TS complains, or rely on the fact that ImageGenNodeData has it.
                                    }
                                    // Re-writing the logic to be cleaner:
                                    const imgNode = (nodes as AppNode[]).find(n => n.type === "imagegen");
                                    if (imgNode) {
                                        // We need to cast data because AppNode is a union and not all data has negativePrompt
                                        const data = imgNode.data as { negativePrompt?: string };
                                        if (!data.negativePrompt) {
                                            workflowSuggestions.push("建议为图片生成节点添加 negativePrompt 以提高生成质量");
                                        }
                                    }
                                }

                                // Add general best practice tips
                                if (practice && practice.tips.length > 0) {
                                    workflowSuggestions.push(`💡 ${scenario}最佳实践: ${practice.tips[0]}`);
                                }

                                // Emit suggestions if any
                                if (workflowSuggestions.length > 0) {
                                    controller.enqueue(
                                        encoder.encode(`data: ${JSON.stringify({
                                            type: "suggestion",
                                            scenario,
                                            content: workflowSuggestions.join("\n")
                                        })}\n\n`)
                                    );
                                }
                            } catch {
                                // Suggestion generation is optional, don't fail on errors
                            }

                            await deductPointsOnServer(req, user.id, "flow_generation", null, "Flow 生成");
                            success = true;
                        } else {
                            // Hard validation failure (no softPass) - emit error and retry
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "tool-call",
                                    tool: "validate_flow",
                                    args: { nodeCount: (nodes as AppNode[]).length, edgeCount: (edges as AppEdge[]).length }
                                })}\n\n`)
                            );
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "tool-result",
                                    tool: "validate_flow",
                                    result: { valid: false, softPass: false, errors: validation.errors }
                                })}\n\n`)
                            );

                            await new Promise(r => setTimeout(r, 600));

                            // Emit Validation Error Step
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "step",
                                    stepType: "validation",
                                    status: "error",
                                    content: `校验未通过: 发现 ${validation.errors.length} 个问题`
                                })}\n\n`)
                            );

                            await new Promise(r => setTimeout(r, 600));

                            // Emit Retry Step Start
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "step",
                                    stepType: "retry",
                                    status: "streaming",
                                    content: "正在尝试自动修复工作流..."
                                })}\n\n`)
                            );

                            await new Promise(r => setTimeout(r, 1000));

                            // Emit Retry Step Completed
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({
                                    type: "step",
                                    stepType: "retry",
                                    status: "completed",
                                    content: "已启动自动修复优化"
                                })}\n\n`)
                            );

                            // 增量修复：只传递错误信息，要求 LLM 输出修正后的节点
                            messages.push({ role: "assistant", content: accumulatedText });
                            messages.push({
                                role: "user",
                                content: `工作流存在以下问题，请修正后重新输出 JSON：

错误信息：
${validation.errors.join("\n")}

请直接输出修正后的完整工作流 JSON，无需其他解释。`
                            });

                            lastError = validation.errors.join("; ");
                            validationAttempt++;
                            thinkingEmitted = false; // Reset for next attempt
                            suggestionEmitted = false;
                        }
                    } catch (error) {
                        // Check for AbortError (timeout)
                        if (error instanceof Error && (error.name === 'AbortError' || (error as any).code === 'ETIMEDOUT')) {
                             lastError = "Generation timed out (limit reached)";
                        } else {
                             lastError = error instanceof Error ? error.message : "Unknown error";
                        }
                        validationAttempt++;
                    }
                }

                // All attempts failed
                if (!success) {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                            type: "error",
                            message: lastError || "Generation failed after retries"
                        })}\n\n`)
                    );
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                            type: "result",
                            title: prompt.slice(0, 20),
                            nodes: [],
                            edges: [],
                        })}\n\n`)
                    );
                }

                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (e) {
        console.error("[Agent Plan API] Error:", e);
        return new Response(
            JSON.stringify({ nodes: [], edges: [], error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }
}
