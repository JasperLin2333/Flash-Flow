export const runtime = "nodejs";

import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";
import { checkPointsOnServer, deductPointsOnServer, pointsExceededResponse } from "@/lib/quotaEdge";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { CORE_RULES, VARIABLE_RULES, EDGE_RULES } from "@/lib/prompts";
import { FULL_EXAMPLES } from "@/lib/prompts/examples";
import { detectIntentFromPrompt, BEST_PRACTICES } from "@/lib/agent/bestPractices";
import { extractBalancedJson, validateWorkflow } from "@/lib/agent/utils";
import { StreamXmlParser } from "@/lib/agent/streamUtils";
import { validateGeneratedWorkflowV1_2 } from "@/lib/agent/generatedWorkflowValidatorV1";
import { deterministicFixWorkflowV1 } from "@/lib/agent/deterministicFixerV1";
import { createSkillTool } from "@/lib/skills/skillTool";
import { getNodeReferenceForPrompt } from "@/lib/agent/nodeReferenceRag";
import { getFlowCaseFewShots } from "@/lib/agent/flowCaseRag";
import { formatSkillIndex, listSkillDefinitions } from "@/lib/skills/skillRegistry";
import { getDefaultSkillIds, routeAgentSkills } from "@/lib/agent/skillRouting";
import { generateClarificationQuestions } from "@/lib/agent/intentRecognition";

// 🔧 根本性修复：校验并修正AI生成的节点配置
function validateAndFixGeneratedNodes(nodes: any[]): any[] {
    return nodes.map(node => {
        if (!node || !node.type) return node;

        // 深拷贝节点数据以避免修改原始对象
        const fixedNode = JSON.parse(JSON.stringify(node));

        // 修复Input节点配置问题
        if (node.type === 'input' && node.data) {
            const data = node.data;

            // 检查单一文本输入场景：只有文本对话开启，其他输入方式都关闭
            const isSingleTextInput =
                data.enableTextInput !== false &&
                data.enableFileInput !== true &&
                data.enableStructuredForm !== true;

            if (isSingleTextInput) {
                // 在单一文本输入场景下，必须设置textRequired=true
                if (data.textRequired !== true) {
                    fixedNode.data.textRequired = true;
                    console.log(`[FIX] Input节点 "${data.label || node.id}" 单一文本输入场景已自动设置 textRequired=true`);
                }
            }
        }

        // 🔧 重点修复：Output节点模板语法问题
        if (node.type === 'output' && node.data && node.data.inputMappings) {
            const mappings = node.data.inputMappings;

            // 检查template模式中的非法语法
            if (mappings.mode === 'template' && mappings.template) {
                let template = mappings.template;
                let hasIllegalSyntax = false;
                let fixApplied = false;

                // 检测并移除Handlebars逻辑标签
                const illegalPatterns = [
                    // 循环语法
                    { pattern: /\{\{#[a-zA-Z]+[^}]*\}\}/g, name: 'Handlebars 开标签' },
                    { pattern: /\{\{\/[a-zA-Z]*\}\}/g, name: 'Handlebars 闭合标签' },
                    // 特定的each循环
                    { pattern: /\{\{#each\s+[^}]+\}\}/gi, name: 'each 循环开始' },
                    { pattern: /\{\{\/each\}\}/gi, name: 'each 循环结束' },
                    // 条件语法
                    { pattern: /\{\{#if\s+[^}]+\}\}/gi, name: 'if 条件开始' },
                    { pattern: /\{\{\/if\}\}/gi, name: 'if 条件结束' },
                    { pattern: /\{\{#unless\s+[^}]+\}\}/gi, name: 'unless 条件开始' },
                    { pattern: /\{\{\/unless\}\}/gi, name: 'unless 条件结束' },
                    { pattern: /\{\{else\}\}/gi, name: 'else 分支' }
                ];

                for (const { pattern, name } of illegalPatterns) {
                    if (pattern.test(template)) {
                        hasIllegalSyntax = true;
                        fixApplied = true;
                        const matches = template.match(pattern) || [];
                        console.log(`[FIX] Output节点 "${node.data.label || node.id}" 检测到非法语法: ${name} (${matches.join(', ')})`);
                        template = template.replace(pattern, '');
                    }
                }

                // 清理残留的不完整标签
                const residualPatterns = [
                    /\{\{[a-zA-Z]*\}\}/g,  // 不完整的标签
                    /\{\{\s*\}\}/g         // 空标签
                ];

                for (const pattern of residualPatterns) {
                    if (pattern.test(template)) {
                        template = template.replace(pattern, '');
                    }
                }

                if (fixApplied) {
                    // 如果模板被清理后为空或基本无效，建议改为direct模式
                    const cleanedTemplate = template.trim();
                    if (!cleanedTemplate || cleanedTemplate.length < 10) {
                        fixedNode.data.inputMappings.mode = 'direct';
                        fixedNode.data.inputMappings.sources = [
                            { type: 'variable', value: '{{上游节点.response}}' }
                        ];
                        delete fixedNode.data.inputMappings.template;
                        console.log(`[FIX] Output节点 "${node.data.label || node.id}" 模板内容无效，已转换为 direct 模式`);
                    } else {
                        fixedNode.data.inputMappings.template = cleanedTemplate;
                        console.log(`[FIX] Output节点 "${node.data.label || node.id}" 已移除非法的Handlebars语法`);
                    }
                }
            }
        }

        return fixedNode;
    });
}



// ============ Agent Configuration ============
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL || "deepseek-v3.2";
const TIMEOUT_ANALYSIS_MS = 60000;
const TIMEOUT_GENERATION_MS = 120000;

function encodeSseEvent(encoder: TextEncoder, payload: unknown) {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function encodeSseDone(encoder: TextEncoder) {
    return encoder.encode("data: [DONE]\n\n");
}

function createSseResponse(status: number, payload: unknown) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encodeSseEvent(encoder, payload));
            controller.enqueue(encodeSseDone(encoder));
            controller.close();
        }
    });
    return new Response(stream, {
        status,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    });
}

function extractTagBlock(text: string, startTag: string, endTag: string) {
    const start = text.indexOf(startTag);
    if (start === -1) return null;
    const end = text.indexOf(endTag, start + startTag.length);
    if (end === -1) return null;
    return text.slice(start + startTag.length, end).trim();
}

function parsePlanSections(planText: string) {
    // DEBUG: Log raw plan text
    console.log('[parsePlanSections] Raw planText:', planText);

    const lines = planText.split("\n").map(l => l.trim());
    const findSectionRange = (title: string) => {
        const header = `## ${title}`;
        const start = lines.findIndex(l => l === header);
        if (start === -1) return null;
        let end = lines.length;
        for (let i = start + 1; i < lines.length; i++) {
            if (lines[i].startsWith("## ")) {
                end = i;
                break;
            }
        }
        return { start: start + 1, end };
    };

    const pickLines = (title: string) => {
        const range = findSectionRange(title);
        if (!range) return [];
        return lines.slice(range.start, range.end).filter(Boolean);
    };

    const refinedIntent = pickLines("需求理解").find(Boolean) || "";

    const workflowLines = pickLines("工作流结构");
    const workflowNodes = workflowLines
        .filter(l => l.startsWith("- [type:"))
        .map(l => {
            const raw = l.replace(/^-\s*/, "");
            const match = raw.match(/^\[type:([a-zA-Z_]+)\]\s*(.+)$/);
            const type = match?.[1] || "unknown";
            const rest = match?.[2] || raw;
            const splitIndex = rest.indexOf("：") >= 0 ? rest.indexOf("：") : rest.indexOf(":");
            const label = splitIndex >= 0 ? rest.slice(0, splitIndex).trim() : rest.trim();
            const description = splitIndex >= 0 ? rest.slice(splitIndex + 1).trim() : "";
            return { type, label, description };
        });

    const useCases = pickLines("适用场景")
        .map(l => l.replace(/^-\s*/, "").trim())
        .filter(Boolean);

    const howToUse = pickLines("使用方法")
        .map(l => l.replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").trim())
        .filter(Boolean);

    // Parse verification questions - accept both bullet points and numbered lists
    const rawVerificationLines = pickLines("验证问题");
    console.log('[parsePlanSections] rawVerificationLines:', rawVerificationLines);

    const verificationQuestions = rawVerificationLines
        .filter(l => {
            // Accept: "- question", "* question", "1. question", "2. question", etc.
            return l.startsWith("- ") || l.startsWith("* ") || /^\d+\.\s/.test(l);
        })
        .map(l => l.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean);

    const steps = planText
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    // DEBUG: Log parsed plan sections
    console.log('[parsePlanSections] verificationQuestions:', verificationQuestions);

    return { refinedIntent, workflowNodes, useCases, howToUse, verificationQuestions, steps };
}

function ensureInputOutputNodesAndEdges(rawNodes: unknown[], rawEdges: unknown[]) {
    const nodes: any[] = Array.isArray(rawNodes) ? JSON.parse(JSON.stringify(rawNodes)) : [];
    const edges: any[] = Array.isArray(rawEdges) ? JSON.parse(JSON.stringify(rawEdges)) : [];

    const fixes: string[] = [];

    const usedIds = new Set<string>(nodes.map(n => n?.id).filter(Boolean));
    const usedLabels = new Set<string>(nodes.map(n => n?.data?.label).filter(Boolean));

    const uniqueId = (base: string) => {
        let id = base;
        let i = 1;
        while (usedIds.has(id)) {
            id = `${base}_${i}`;
            i++;
        }
        usedIds.add(id);
        return id;
    };

    const uniqueLabel = (base: string) => {
        let label = base;
        let i = 1;
        while (usedLabels.has(label)) {
            label = `${base}${i}`;
            i++;
        }
        usedLabels.add(label);
        return label;
    };

    const hasInput = nodes.some(n => n?.type === "input");
    const hasOutput = nodes.some(n => n?.type === "output");

    let inputId: string | null = null;
    let outputId: string | null = null;

    const guessOutputSource = () => {
        const candidates: Array<{ type: string; field: string }> = [
            { type: "llm", field: "response" },
            { type: "rag", field: "documents" },
            { type: "tool", field: "result" },
            { type: "imagegen", field: "imageUrl" },
            { type: "input", field: "user_input" },
        ];

        for (const c of candidates) {
            for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                if (n?.type === c.type && typeof n?.id === "string" && n.id) {
                    return `{{${n.id}.${c.field}}}`;
                }
            }
        }
        return "{{response}}";
    };

    if (!hasInput) {
        inputId = uniqueId("auto_input");
        nodes.unshift({ id: inputId, type: "input", data: { label: uniqueLabel("用户输入") } });
        fixes.push("已自动补齐「输入」节点");
    }

    if (!hasOutput) {
        outputId = uniqueId("auto_output");
        nodes.push({
            id: outputId,
            type: "output",
            data: {
                label: uniqueLabel("最终输出"),
                inputMappings: {
                    mode: "select",
                    sources: [{ type: "variable", value: guessOutputSource() }],
                },
            }
        });
        fixes.push("已自动补齐「输出」节点");
    }

    if (!inputId && !outputId) {
        return { nodes, edges, fixes };
    }

    const nodeIdSet = new Set<string>(nodes.map(n => n?.id).filter(Boolean));
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    const idToType = new Map<string, string>();
    nodes.forEach(n => {
        if (n?.id && n?.type) idToType.set(n.id, n.type);
    });

    const edgeKeySet = new Set<string>();
    edges
        .filter(e => nodeIdSet.has(e?.source) && nodeIdSet.has(e?.target))
        .forEach(e => {
            edgeKeySet.add(`${e.source}::${e.target}`);
        });

    const computeDegrees = () => {
        inDegree.clear();
        outDegree.clear();
        nodeIdSet.forEach(id => {
            inDegree.set(id, 0);
            outDegree.set(id, 0);
        });

        edges
            .filter(e => nodeIdSet.has(e?.source) && nodeIdSet.has(e?.target))
            .forEach(e => {
                inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
                outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
            });
    };

    computeDegrees();

    const getStartCandidates = () =>
        nodes
            .filter(n => n?.id && n.type !== "input" && n.type !== "output")
            .filter(n => (inDegree.get(n.id) || 0) === 0)
            .map(n => n.id);

    const getEndCandidates = () =>
        nodes
            .filter(n => n?.id && n.type !== "output")
            .filter(n => (outDegree.get(n.id) || 0) === 0)
            .map(n => n.id);

    if (inputId) {
        const candidates = getStartCandidates();
        const targets = candidates.length > 0 ? candidates : nodes.filter(n => n?.id && n.id !== inputId && n.type !== "output").slice(0, 1).map(n => n.id);
        targets.forEach((targetId, i) => {
            const key = `${inputId}::${targetId}`;
            if (edgeKeySet.has(key)) return;
            edgeKeySet.add(key);
            edges.push({ id: `edge_${inputId}_${targetId}_auto_${i}`, source: inputId, target: targetId });
        });
        computeDegrees();
    }

    if (outputId) {
        computeDegrees();
        const candidates = getEndCandidates().filter(id => id !== outputId);
        const preferred = candidates.filter(id => idToType.get(id) !== "input");
        const sources = preferred.length > 0
            ? preferred
            : (candidates.length > 0 ? candidates : nodes.filter(n => n?.id && n.id !== outputId).slice(-1).map(n => n.id));
        sources.forEach((sourceId, i) => {
            const key = `${sourceId}::${outputId}`;
            if (edgeKeySet.has(key)) return;
            edgeKeySet.add(key);
            edges.push({ id: `edge_${sourceId}_${outputId}_auto_${i}`, source: sourceId, target: outputId });
        });
    }

    return { nodes, edges, fixes };
}

// ============ Agent System Prompt (Modular) ============

// Phase 1: Deep Analysis - Three-phase reasoning framework
const ANALYSIS_ONLY_PROMPT = `你是 Flash Flow Agent，一个专业的工作流设计AI。你的任务是**深度理解**用户需求，而不是简单复述。

## 🧠 核心原则
1. **不要复述** - 用户说的话他们自己知道，你要挖掘他们没说的
2. **主动推理** - 根据上下文推导隐含意图和约束
3. **发现盲点** - 识别用户可能遗漏的边界情况
4. **技术可行性** - 规划必须符合平台能力。例如：
   - LLM 无法直接读取文件，必须经过 RAG。
   - url_reader 输出的是文本，无法直接作为 RAG 的文件输入。
   - 互斥路径必须在 Output 节点汇聚。
5. **用户视角** - 规划必须用**用户听得懂的语言**描述

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
- [type:input] ${'{节点名}'}：${'{触发：何时会用到；做什么：这一步要完成什么；输出：产出什么给下一步用（短句）}'}
- [type:llm] ${'{节点名}'}：${'{触发：何时会用到；做什么：这一步要完成什么；输出：产出什么给下一步用（短句）}'}
- [type:output] ${'{节点名}'}：${'{触发：何时会用到；做什么：这一步要完成什么；输出：用户最终会看到/拿到什么（短句）}'}

## 适用场景
- ${'{场景1}'}
- ${'{场景2}'}
- ${'{场景3}'}

## 使用方法
1. ${'{步骤1}'}
2. ${'{步骤2}'}
3. ${'{步骤3}'}

## 验证问题
根据你对用户需求的理解，提出 2-3 个问题来确认你的方案是否正确。问题应该：
1. 确认你对使用场景的理解是否正确（例如："这个工作流是用于 XXX 场景吗？"）
2. 询问是否需要增加某些节点（例如："你需要先搜索网络/知识库吗？"）
3. 确认输出格式或特殊需求（例如："你需要严格的 JSON 格式输出吗？"）
- ${'{问题1}'}
- ${'{问题2}'}
- ${'{问题3（可选）}'}
</plan>

## ⚡️ 规则
- 必须包含 <plan> 标签
- <plan> 内容给用户看：用短句、说人话，尽量不出现术语（如 JSON、参数、Handlebars、NodeID）
- **不要**提及"下一步"
- 节点必须带 [type:xxx] 标记，支持: input, llm, rag, tool, imagegen, branch, output
- **必须**包含"验证问题"部分，提出 2-3 个具体问题
`;

// Phase 2: Generation - Compile approved plan into JSON
const GENERATION_PROMPT_BASE = `你是 Flash Flow Agent，一个专业的工作流设计AI。

## 🎯 任务
你会收到用户输入，其中包含 **<approved_plan>**（用户已确认的方案）与原始补充需求。
你的任务是把 <approved_plan> **精准翻译**为可执行的工作流 JSON；不要重新做需求澄清，不要改写核心结构。

## 🧠 执行流程
用户已确认需求分析与方案，现在请严格按顺序执行并输出以下结构化步骤：

### 步骤 1：蓝图映射 (Plan Mapping)
<step type="mapping">
把 <approved_plan> 的每一步映射成工作流节点清单，并明确每个节点的输入来源与职责边界。

输出格式（必须包含且按顺序）：
1. **节点清单**（每行一个）：
   - NodeID: ... | type: ... | label: ... | 负责: ...
2. **调用链**（一行）：
   - Input -> ... -> Output（若有分支，明确 true/false 路径）
</step>

### 步骤 2：数据契约定义 (Data Contract) 🔥
<step type="data_flow">
定义每个节点对外暴露的核心输出字段，以及下游节点的引用语法，防止变量引用错误。

| 节点 ID | 节点类型 | 核心输出字段 | 下游引用语法 (Handlebars) |
| :--- | :--- | :--- | :--- |
| input | input | input.topic | {{input.topic}} |
| ... | ... | ... | ... |

规则：
1. 引用必须使用 {{节点Label.field}} 或 {{node_id.field}} 格式（优先 Label，且前缀必须真实存在）。
2. 下游引用前，上游节点必须存在且有连线。
3. Branch 节点必须通过 sourceHandle 区分 true/false 两条边。
</step>

### 步骤 3：实现要点 (Implementation Draft)
<step type="drafting">
基于步骤 2 的数据契约，为每个节点补齐关键配置，确保可以直接写入 JSON。
1. LLM 节点：System Prompt / Model / Temperature / 输入引用（必须来自步骤 2）
2. RAG/Tool/HTTP 节点：查询/参数/输入引用（必须来自步骤 2）
3. Branch 节点：判断条件所用变量引用与 true/false 分支含义

约束：
1. 不要输出任何 JSON、YAML、代码块或 \`\`\` 标记。
2. 不要在本步骤展示完整节点 JSON；只用要点描述“哪些字段如何填”，每个节点最多 2～3 行要点。
</step>

### 步骤 4：合规自检 (Compliance Check)
<step type="verification">
逐项核对（发现问题必须在生成 JSON 前自我修正）：
1. 变量引用是否都有对应上游节点与连线？
2. Branch 的 sourceHandle 是否正确设置为 "true"/"false"？
3. **Output 节点模板检查**：
   - ✅ template 模式中绝对禁止 Handlebars 逻辑标签（{{#each}}, {{#if}}, {{#unless}} 等）
   - ✅ 复杂逻辑应由上游 LLM 节点处理，Output 节点仅做简单变量替换
   - ✅ 优先考虑使用 direct/select/merge 模式替代复杂的 template 模式
4. 是否避免把 Input 节点的 files 直接传给 LLM（应通过 RAG 中转）？
5. 拓扑是否无自环/循环依赖？
</step>

### 步骤 5：生成 JSON
直接输出一个 JSON 对象（以 { 开头，以 } 结尾），不要使用 Markdown 代码块，不要添加任何解释性文字。

## ⚡️ 规则
- 严格按顺序执行步骤 1 → 2 → 3 → 4 → 5
- 每个步骤必须使用对应的 <step type="xxx"> 标签
- 不要输出 <plan> 标签（plan 已在上一阶段完成）
- 任何 <step> 内容里都禁止输出 JSON 或 \`\`\` 代码块；JSON 仅允许在最后一段输出且必须是唯一输出
- 最后一段 JSON 后不要输出任何额外文本
`;

function buildGenerationPrompt(nodeReference: string) {
    return `${GENERATION_PROMPT_BASE}

${CORE_RULES}

${nodeReference}

${VARIABLE_RULES}

${EDGE_RULES}

${FULL_EXAMPLES}`;
}

// Direct mode (no confirmation needed) - 4-step flow with deep reasoning
const DIRECT_MODE_PROMPT_BASE = `你是 Flash Flow Agent，一个专业的工作流设计AI。你的任务是**深度理解**用户需求，而不是简单复述。

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

### 步骤 2：任务规划（面向用户）
<plan>
## 需求理解
${'{直接一句话描述核心目标，禁止使用"我理解"、"用户想要"等前缀}'}

## 工作流结构
- [type:input] ${'{节点名}'}：${'{触发：何时会用到；做什么：这一步要完成什么；输出：产出什么给下一步用（短句）}'}
- [type:llm] ${'{节点名}'}：${'{触发：何时会用到；做什么：这一步要完成什么；输出：产出什么给下一步用（短句）}'}
- [type:output] ${'{节点名}'}：${'{触发：何时会用到；做什么：这一步要完成什么；输出：用户最终会看到/拿到什么（短句）}'}

## 适用场景
- ${'{场景1}'}
- ${'{场景2}'}
- ${'{场景3}'}

## 使用方法
1. ${'{步骤1}'}
2. ${'{步骤2}'}
3. ${'{步骤3}'}
</plan>

### 步骤 3：蓝图映射 (Plan Mapping)
<step type="mapping">
把上面的分析与 <plan> 方案映射成工作流节点清单，并明确每个节点的输入来源与职责边界。

输出格式（必须包含且按顺序）：
1. **节点清单**（每行一个）：
   - NodeID: ... | type: ... | label: ... | 负责: ...
2. **调用链**（一行）：
   - Input -> ... -> Output（若有分支，明确 true/false 路径）
</step>

### 步骤 4：数据契约定义 (Data Contract) 🔥
<step type="data_flow">
定义每个节点对外暴露的核心输出字段，以及下游节点的引用语法，防止变量引用错误。

| 节点 ID | 节点类型 | 核心输出字段 | 下游引用语法 (Handlebars) |
| :--- | :--- | :--- | :--- |
| input | input | input.topic | {{input.topic}} |
| ... | ... | ... | ... |

规则：
1. 引用必须使用 {{节点Label.field}} 或 {{node_id.field}} 格式（优先 Label，且前缀必须真实存在）。
2. 下游引用前，上游节点必须存在且有连线。
3. Branch 节点必须通过 sourceHandle 区分 true/false 两条边。
</step>

### 步骤 5：实现要点 (Implementation Draft)
<step type="drafting">
基于步骤 4 的数据契约，为每个节点补齐关键配置，确保可以直接写入 JSON。
1. LLM 节点：System Prompt / Model / Temperature / 输入引用（必须来自步骤 4）
2. RAG/Tool/HTTP 节点：查询/参数/输入引用（必须来自步骤 4）
3. Branch 节点：判断条件所用变量引用与 true/false 分支含义

约束：
1. 不要输出任何 JSON、YAML、代码块或 \`\`\` 标记。
2. 不要在本步骤展示完整节点 JSON；只用要点描述“哪些字段如何填”，每个节点最多 2～3 行要点。
</step>

### 步骤 6：合规自检 (Compliance Check)
<step type="verification">
逐项核对（发现问题必须在生成 JSON 前自我修正）：
1. 变量引用是否都有对应上游节点与连线？
2. Branch 的 sourceHandle 是否正确设置为 \"true\"/\"false\"？
3. Output 是否只做输出拼接，不写 Handlebars 逻辑？
4. 是否避免把 Input 节点的 files 直接传给 LLM（应通过 RAG 中转）？
5. 拓扑是否无自环/循环依赖？
</step>

### 步骤 7：生成 JSON
直接输出一个 JSON 对象（以 { 开头，以 } 结尾），不要使用 Markdown 代码块，不要添加任何解释性文字。

## ⚡️ 规则
- 严格按顺序执行步骤 1 → 2 → 3 → 4 → 5 → 6 → 7
- 每个步骤使用对应的 <step type="xxx"> 标签
- 必须包含 <plan> 标签
- <plan> 内容给用户看：用短句、说人话，尽量不出现术语（如 JSON、参数、Handlebars、NodeID）
- 节点必须带 [type:xxx] 标记，支持: input, llm, rag, tool, imagegen, branch, output
- 任何 <step> 内容里都禁止输出 JSON 或 \`\`\` 代码块；JSON 仅允许在最后一段输出且必须是唯一输出
- 最后一段 JSON 后不要输出任何额外文本
`;

function buildDirectModePrompt(nodeReference: string) {
    return `${DIRECT_MODE_PROMPT_BASE}

${CORE_RULES}

${nodeReference}

${VARIABLE_RULES}

${EDGE_RULES}

${FULL_EXAMPLES}`;
}

// ============ Main Handler ============
export async function POST(req: Request) {
    const reqClone = req.clone();

    try {
        const body = await reqClone.json();
        const { prompt, enableClarification, skipAutomatedValidation } = body;
        const shouldSkipAutomatedValidation = skipAutomatedValidation === true;

        const user = await getAuthenticatedUser(req);
        if (!user) {
            const res = unauthorizedResponse();
            return createSseResponse(res.status, { type: "step", stepType: "error", status: "error", content: "请先登录后再生成工作流。" });
        }

        const pointsCheck = await checkPointsOnServer(req, user.id, "flow_generation");
        if (!pointsCheck.allowed) {
            const res = pointsExceededResponse(pointsCheck.balance, pointsCheck.required);
            return createSseResponse(res.status, { type: "step", stepType: "error", status: "error", content: `积分不足，当前余额 ${pointsCheck.balance}，需要 ${pointsCheck.required}。` });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const emit = (payload: unknown) => controller.enqueue(encodeSseEvent(encoder, payload));
                const finish = () => {
                    controller.enqueue(encodeSseDone(encoder));
                    controller.close();
                };

                try {
                    if (!prompt?.trim()) {
                        emit({ type: "step", stepType: "analysis", status: "error", content: "先写下你的需求，我再开始生成工作流。" });
                        finish();
                        return;
                    }

                    const modelName = DEFAULT_MODEL;
                    const provider = getProviderForModel(modelName);
                    const config = PROVIDER_CONFIG[provider];
                    const apiKey = config.getApiKey();
                    if (!apiKey) {
                        emit({ type: "step", stepType: "error", status: "error", content: `API key for ${provider} is not configured.` });
                        finish();
                        return;
                    }

                    const providerInstance = createOpenAI({
                        apiKey,
                        baseURL: config.baseURL,
                    });

                    const enableAgentSkills = process.env.AGENT_SKILLS_ENABLED !== "false";
                    const classifierEnabled = process.env.AGENT_SKILL_CLASSIFIER_ENABLED !== "false";
                    const allowlist = (process.env.AGENT_SKILL_ALLOWLIST || "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    const envDefaults = (process.env.AGENT_SKILL_DEFAULTS || "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    const maxSkillCount = Number(process.env.AGENT_SKILL_CLASSIFIER_MAX_SKILLS || 3);

                    const candidateSkills = enableAgentSkills
                        ? await listSkillDefinitions("agent", allowlist)
                        : [];

                    const routingResult = enableAgentSkills && classifierEnabled && candidateSkills.length > 0
                        ? await routeAgentSkills(prompt, candidateSkills, { maxSkills: maxSkillCount })
                        : null;
                    if (routingResult && process.env.NODE_ENV === "development") {
                        console.log(
                            `[AgentSkillRouting] scenario=${routingResult.scenario} confidence=${routingResult.confidence} skills=${routingResult.skillIds.join(",") || "none"} clarify=${routingResult.clarifyDimensions.join(",") || "none"}`
                        );
                    }

                    const selectedSkillIds = enableAgentSkills
                        ? (routingResult?.skillIds?.length
                            ? routingResult.skillIds
                            : getDefaultSkillIds(candidateSkills, envDefaults))
                        : [];

                    const skillSetup = enableAgentSkills && selectedSkillIds.length > 0
                        ? await createSkillTool({ scope: "agent", allowlist: selectedSkillIds })
                        : null;
                    const skillInstructions =
                        skillSetup && skillSetup.skills.length > 0
                            ? `\n## 🧩 可用技能\n${formatSkillIndex(skillSetup.skills)}\n请在开始前依次调用所有可用技能。`
                            : "";
                    const tools = skillSetup && skillSetup.skills.length > 0 ? { skill: skillSetup.skillTool } : undefined;

                    const scenario = routingResult?.scenario || detectIntentFromPrompt(prompt);
                    const practice = BEST_PRACTICES[scenario];
                    const practices = practice ? practice.tips : [];
                    const practicesPrompt = practices.length > 0
                        ? `\n## 💡 针对此场景的最佳实践\n${practices.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}`
                        : "";
                    const extraInstructions = `${practicesPrompt}${skillInstructions}`;

                    const isPlanConfirmed = typeof prompt === "string" && (prompt.includes("[PLAN_CONFIRMED]") || prompt.includes("<approved_plan>"));
                    emit({ type: "thinking-start" });
                    let approvedPlanBlock: string | null = null;
                    let phase: "plan" | "generation" = "generation";
                    let planConfirmStatus: string = "idle";

                    let fullText = "";
                    let planBuffer = "";
                    let currentStepType: string | null = null;
                    let isPlanTag = false;

                    const parser = new StreamXmlParser((event) => {
                        if (event.type === 'tag_open') {
                            if (event.tagName === 'step') {
                                if (phase === "generation" && planConfirmStatus === "streaming") {
                                    emit({ type: "step", stepType: "plan_confirm", status: "completed", content: "" });
                                    planConfirmStatus = "completed";
                                }
                                currentStepType = event.attributes?.type || null;
                            } else if (event.tagName === 'plan') {
                                isPlanTag = true;
                            }
                        } else if (event.type === 'content') {
                            if (currentStepType && event.content) {
                                emit({ type: "step", stepType: currentStepType, status: "streaming", content: event.content });
                                if (currentStepType === 'analysis') {
                                    emit({ type: "thinking", content: event.content });
                                }
                            } else if (isPlanTag && event.content) {
                                planBuffer += event.content;
                            }
                        } else if (event.type === 'tag_close') {
                            if (event.tagName === 'step') {
                                const closingStepType = currentStepType;
                                if (closingStepType) {
                                    emit({ type: "step", stepType: closingStepType, status: "completed", content: "" });
                                }
                                if (phase === "plan" && closingStepType === "analysis" && planConfirmStatus === "idle") {
                                    emit({ type: "step", stepType: "plan_confirm", status: "streaming", content: "" });
                                    planConfirmStatus = "streaming";
                                }
                                currentStepType = null;
                            } else if (event.tagName === 'plan') {
                                isPlanTag = false;
                            }
                        }
                    });

                    const streamWithParser = async (system: string, userContent: string, temperature: number, abortSignal?: AbortSignal) => {
                        const stopWhen =
                            tools
                                ? ({ steps }: { steps: Array<{ toolCalls?: Array<unknown> }> }) => {
                                    const hadToolCall = steps.some(step => (step.toolCalls?.length ?? 0) > 0);
                                    const last = steps[steps.length - 1];
                                    const lastToolCalls = last?.toolCalls?.length ?? 0;
                                    if (!hadToolCall) {
                                        return steps.length >= 1;
                                    }
                                    return steps.length >= 2 && lastToolCalls === 0;
                                }
                                : undefined;

                        const result = streamText({
                            model: providerInstance.chat(modelName),
                            system,
                            messages: [{ role: "user", content: userContent }],
                            temperature,
                            tools,
                            abortSignal,
                            stopWhen,
                        });
                        for await (const part of result.fullStream) {
                            if (part.type === "text-delta" && part.text) {
                                fullText += part.text;
                                parser.process(part.text);
                            } else if (part.type === "reasoning-delta") {
                                const chunk = (part as { delta?: string; text?: string }).delta || (part as { text?: string }).text || "";
                                if (chunk) {
                                    fullText += chunk;
                                    parser.process(chunk);
                                }
                            } else if (part.type === "tool-input-available") {
                                emit({ type: "tool-call", tool: part.toolName, args: part.input });
                            } else if (part.type === "tool-output-available") {
                                emit({ type: "tool-result", tool: part.toolCallId, result: part.output });
                            } else if (part.type === "tool-output-error") {
                                emit({ type: "tool-result", tool: part.toolCallId, result: { error: part.errorText } });
                            }
                        }
                    };

                    // ========== Intent is now pre-determined by frontend (via /api/intent-router) ==========
                    // The frontend calls /api/intent-router before this endpoint and passes the result as enableClarification
                    // We just use the value directly without re-detecting
                    const shouldRequestPlan = Boolean(enableClarification) && !isPlanConfirmed;
                    const shouldAutoPlan = !enableClarification && !isPlanConfirmed;

                    if (shouldRequestPlan || shouldAutoPlan) {
                        phase = "plan";
                        const PLAN_MAX_RETRIES = 2;
                        let planBlock: string | null = null;

                        for (let attempt = 0; attempt < PLAN_MAX_RETRIES; attempt++) {
                            fullText = "";
                            planBuffer = "";

                            const abortController = new AbortController();
                            const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_ANALYSIS_MS);

                            try {
                                await streamWithParser(
                                    ANALYSIS_ONLY_PROMPT + extraInstructions,
                                    `用户需求: ${prompt}`,
                                    0.5,
                                    abortController.signal
                                );
                            } finally {
                                clearTimeout(timeoutId);
                            }

                            planBlock = planBuffer.trim() || extractTagBlock(fullText, `<plan>`, `</plan>`);
                            if (planBlock) break;
                        }

                        emit({ type: "thinking-end" });

                        if (planBlock) {
                            if (planConfirmStatus === "idle") {
                                emit({ type: "step", stepType: "plan_confirm", status: "streaming", content: "" });
                                planConfirmStatus = "streaming";
                            }
                            if (shouldRequestPlan) {
                                const parsedPlan = parsePlanSections(planBlock);
                                const clarifyDimensions = routingResult?.clarifyDimensions || [];
                                const clarifiedQuestions = clarifyDimensions.length > 0
                                    ? generateClarificationQuestions(clarifyDimensions)
                                    : [];
                                if (clarifiedQuestions.length > 0) {
                                    parsedPlan.verificationQuestions = clarifiedQuestions;
                                }
                                emit({
                                    type: "plan",
                                    userPrompt: parsedPlan.refinedIntent || String(prompt),
                                    steps: parsedPlan.steps,
                                    refinedIntent: parsedPlan.refinedIntent,
                                    workflowNodes: parsedPlan.workflowNodes,
                                    useCases: parsedPlan.useCases,
                                    howToUse: parsedPlan.howToUse,
                                    verificationQuestions: parsedPlan.verificationQuestions
                                });
                            } else {
                                approvedPlanBlock = planBlock;
                            }
                        } else {
                            emit({
                                type: "step",
                                stepType: "fallback",
                                status: "completed",
                                content: "规划阶段未产出有效计划，我会直接生成工作流（你可以稍后再调整）。"
                            });
                        }
                        if (planBlock && shouldRequestPlan) {
                            finish();
                            return;
                        }
                        fullText = "";
                        phase = "generation";
                    }

                    const shouldUseGenerationPrompt = isPlanConfirmed || Boolean(approvedPlanBlock);

                    const enableNodeRag = process.env.AGENT_NODE_RAG_ENABLED !== "false";
                    const ragTopK = Number(process.env.AGENT_NODE_RAG_TOP_K || 6);
                    const ragThreshold = Number(process.env.AGENT_NODE_RAG_THRESHOLD || 0.6);
                    const ragCategory = process.env.AGENT_NODE_RAG_CATEGORY || undefined;

                    const planBlockForRag = approvedPlanBlock
                        || (isPlanConfirmed ? extractTagBlock(String(prompt || ""), "<approved_plan>", "</approved_plan>") : null);

                    const nodeReferenceResult = await getNodeReferenceForPrompt({
                        prompt: String(prompt || ""),
                        planBlock: planBlockForRag,
                        enableRag: enableNodeRag,
                        topK: ragTopK,
                        threshold: ragThreshold,
                        category: ragCategory,
                    });

                    const enableFlowCaseRag = process.env.AGENT_FLOW_CASE_RAG_ENABLED !== "false";
                    const flowCaseTopK = Number(process.env.AGENT_FLOW_CASE_RAG_TOP_K || 1);
                    const flowCaseThreshold = Number(process.env.AGENT_FLOW_CASE_RAG_THRESHOLD || 0.45);
                    const flowCaseCategory = process.env.AGENT_FLOW_CASE_RAG_CATEGORY || "flow_case";

                    const flowCaseResult = await getFlowCaseFewShots({
                        prompt: String(prompt || ""),
                        planBlock: planBlockForRag,
                        enableRag: enableFlowCaseRag,
                        topK: flowCaseTopK,
                        threshold: flowCaseThreshold,
                        category: flowCaseCategory,
                    });

                    if (process.env.NODE_ENV === "development") {
                        console.log(
                            `[AgentNodeReference] source=${nodeReferenceResult.source} types=${nodeReferenceResult.types.join(",") || "none"} ragCount=${nodeReferenceResult.ragCount ?? 0}`
                        );
                        console.log(
                            `[AgentFlowCaseRag] source=${flowCaseResult.source} ragCount=${flowCaseResult.ragCount}`
                        );
                    }

                    const showRagStep = process.env.NEXT_PUBLIC_AGENT_RAG_STEP_UI === "true"
                        || process.env.AGENT_RAG_STEP_UI === "true";
                    if (showRagStep) {
                        const nodeRagSummary = nodeReferenceResult.source === "rag"
                            ? `节点规范：命中 ${nodeReferenceResult.ragCount ?? 0} 条（${nodeReferenceResult.types.join(",") || "none"}）`
                            : "节点规范：未命中（已用本地兜底）";
                        const caseRagSummary = flowCaseResult.source === "rag"
                            ? `案例：命中 ${flowCaseResult.ragCount} 条`
                            : "案例：未命中（未注入）";
                        emit({
                            type: "step",
                            stepType: "rag_context",
                            status: "completed",
                            content: `${nodeRagSummary}\n${caseRagSummary}`
                        });
                    }

                    const nodeReference = nodeReferenceResult.reference;
                    const caseInstructions = flowCaseResult.cases.length > 0
                        ? `\n## ✅ 参考工作流案例（完整 JSON）\n以下案例仅用于结构与字段参考，不要照抄业务内容。\n${flowCaseResult.cases.map((item, i) => `\n### Case ${i + 1}: ${item.title || "Untitled"}\n${item.content}\n`).join("\n")}\n`
                        : "";

                    const systemPrompt = shouldUseGenerationPrompt
                        ? (buildGenerationPrompt(nodeReference) + extraInstructions + caseInstructions)
                        : (buildDirectModePrompt(nodeReference) + extraInstructions + caseInstructions);
                    const userContent = approvedPlanBlock && !isPlanConfirmed
                        ? `用户需求: ${prompt}

<approved_plan>
${approvedPlanBlock}
</approved_plan>`
                        : `用户需求: ${prompt}`;

                    const abortController = new AbortController();
                    const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_GENERATION_MS);

                    try {
                        await streamWithParser(systemPrompt, userContent, 0.2, abortController.signal);
                    } finally {
                        clearTimeout(timeoutId);
                    }

                    if (planConfirmStatus !== "completed" && planConfirmStatus !== "idle") {
                        emit({ type: "step", stepType: "plan_confirm", status: "completed", content: "" });
                        planConfirmStatus = "completed";
                    }

                    emit({ type: "thinking-end" });

                    const jsonText = extractBalancedJson(fullText);
                    if (!jsonText) {
                        emit({ type: "step", stepType: "error", status: "error", content: "生成结果缺少合法 JSON，已中止。请重试或简化需求。" });
                        finish();
                        return;
                    }

                    const workflow = JSON.parse(jsonText);
                    let nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
                    let edges = Array.isArray(workflow.edges) ? workflow.edges : [];

                    // 🔧 根本性修复：后端校验和自动修正AI生成的配置问题
                    nodes = validateAndFixGeneratedNodes(nodes);

                    const enableReport = process.env.FLOW_VALIDATION_REPORT_ENABLED === "true";
                    const enableSafeFix = process.env.FLOW_VALIDATION_SAFE_FIX_ENABLED === "true";
                    const reportBefore = validateGeneratedWorkflowV1_2(nodes, edges);

                    if (enableReport && reportBefore.hardErrors.length > 0) {
                        const grouped = new Map<string, { code: string; message: string; count: number; sampleLocs: string[] }>();
                        for (const e of reportBefore.hardErrors) {
                            const key = `${e.code}||${e.message}`;
                            const cur = grouped.get(key) || { code: e.code, message: e.message, count: 0, sampleLocs: [] };
                            cur.count += 1;
                            const locParts = [
                                e.location?.nodeId ? `node:${e.location.nodeId}` : null,
                                e.location?.edgeId ? `edge:${e.location.edgeId}` : null,
                                e.location?.fieldPath ? `field:${e.location.fieldPath}` : null,
                            ].filter(Boolean) as string[];
                            if (locParts.length > 0 && cur.sampleLocs.length < 3) {
                                const loc = `(${locParts.join(", ")})`;
                                if (!cur.sampleLocs.includes(loc)) cur.sampleLocs.push(loc);
                            }
                            grouped.set(key, cur);
                        }
                        const items = Array.from(grouped.values());
                        const lines = items.slice(0, 20).map((g) => {
                            const countSuffix = g.count > 1 ? ` x${g.count}` : "";
                            const locSuffix = g.sampleLocs.length > 0 ? ` ${g.sampleLocs.join(" ")}` : "";
                            return `- ${g.code} ${g.message}${countSuffix}${locSuffix}`;
                        });
                        const more = items.length > 20 ? `\n- ... 还有 ${items.length - 20} 类` : "";
                        emit({ type: "step", stepType: "validation", status: "completed", content: `[校验报告] 发现 Hard Error：${reportBefore.hardErrors.length} 条（共 ${items.length} 类）\n${lines.join("\n")}${more}` });
                    }

                    const includeIoInDeterministicFix = process.env.FLOW_DETERMINISTIC_FIX_INCLUDE_IO === "true";
                    const fixResult = enableSafeFix && reportBefore.hardErrors.length > 0
                        ? deterministicFixWorkflowV1(nodes, edges, {
                            includeInputOutput: includeIoInDeterministicFix,
                            safeFixOptions: {
                                removeInvalidEdges: process.env.FLOW_SAFE_FIX_REMOVE_INVALID_EDGES !== "false",
                                dedupeEdges: process.env.FLOW_SAFE_FIX_DEDUPE_EDGES !== "false",
                                ensureEdgeIds: process.env.FLOW_SAFE_FIX_ENSURE_EDGE_IDS !== "false",
                                replaceVariableIdPrefixToLabel: process.env.FLOW_SAFE_FIX_ID_TO_LABEL !== "false",
                            }
                        })
                        : null;

                    if (fixResult) {
                        const reportAfter = validateGeneratedWorkflowV1_2(fixResult.nodes, fixResult.edges);
                        const improved = reportAfter.hardErrors.length < reportBefore.hardErrors.length;
                        if (improved) {
                            nodes = fixResult.nodes;
                            edges = fixResult.edges;
                            if (enableReport && fixResult.fixes.length > 0) {
                                const fixLines = fixResult.fixes.slice(0, 20).map((x) => `- ${x}`);
                                const moreFix = fixResult.fixes.length > 20 ? `\n- ... 还有 ${fixResult.fixes.length - 20} 条` : "";
                                emit({ type: "step", stepType: "validation_fix", status: "completed", content: `[安全修复] Hard Error ${reportBefore.hardErrors.length} → ${reportAfter.hardErrors.length}\n${fixLines.join("\n")}${moreFix}` });
                            }
                        } else if (enableReport && fixResult.fixes.length > 0) {
                            emit({ type: "step", stepType: "validation_fix", status: "completed", content: `[安全修复] 本次修复未降低 Hard Error（${reportBefore.hardErrors.length} → ${reportAfter.hardErrors.length}），已回退到原工作流。` });
                        }
                    }

                    let validation: ReturnType<typeof validateWorkflow> | null = null;
                    if (!shouldSkipAutomatedValidation) {
                        const enableValidateWorkflowReport = process.env.FLOW_VALIDATE_WORKFLOW_REPORT_ENABLED === "true";
                        const ensured = ensureInputOutputNodesAndEdges(nodes, edges);
                        nodes = ensured.nodes;
                        edges = ensured.edges;
                        if (enableValidateWorkflowReport && ensured.fixes.length > 0) {
                            emit({
                                type: "step",
                                stepType: "verification",
                                status: "completed",
                                content: ensured.fixes.join("\n")
                            });
                        }

                        validation = validateWorkflow(nodes, edges);
                    }

                    await deductPointsOnServer(req, user.id, "flow_generation", null, "Flow 生成 (Agent)");

                    emit({
                        type: "result",
                        title: workflow.title || String(prompt).slice(0, 20),
                        nodes: validation?.fixedNodes || nodes,
                        edges: validation?.fixedEdges || edges
                    });
                    finish();
                } catch (e) {
                    const message = e instanceof Error ? e.message : "生成失败，请稍后重试";
                    emit({ type: "step", stepType: "error", status: "error", content: message });
                    finish();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        });

    } catch (e) {
        console.error("Agent API error:", e);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encodeSseEvent(encoder, { type: "step", stepType: "error", status: "error", content: e instanceof Error ? e.message : "服务器开小差了，请稍后再试。" }));
                controller.enqueue(encodeSseDone(encoder));
                controller.close();
            }
        });
        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        });
    }
}
