import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

import { CORE_RULES, NODE_REFERENCE, VARIABLE_RULES, EDGE_RULES } from "@/lib/prompts";
import { extractBalancedJson } from "@/lib/agent/utils";
import { validateGeneratedWorkflowV1_2 } from "@/lib/agent/generatedWorkflowValidatorV1";
import { deterministicFixWorkflowV1 } from "@/lib/agent/deterministicFixerV1";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";

const ROOT = process.cwd();

function loadEnv() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) {
      dotenv.config({ path: full, override: true });
    }
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function slugify(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii;
}

type FlowSeed = {
  title: string;
  goal: string;
  tags: string[];
};

const DEFAULT_SEEDS: FlowSeed[] = [
  { title: "智能旅游助手", goal: "用户输入城市和天数，联网搜索美食和景点，生成不走回头路的行程表和交通建议。", tags: ["旅行", "规划", "交通"] },
  { title: "会议纪要整理", goal: "把会议录音文本整理成结构化纪要，并输出待办列表。", tags: ["办公", "会议", "总结"] },
  { title: "邮件回复助手", goal: "根据用户提供的邮件内容，生成礼貌专业的回复草稿。", tags: ["办公", "邮件", "写作"] },
  { title: "日程冲突检测", goal: "用户输入多个日程事件，识别冲突并给出调整建议。", tags: ["效率", "日程", "规划"] },
  { title: "每日工作复盘", goal: "引导用户填写今日工作内容并生成复盘总结与改进建议。", tags: ["效率", "复盘", "办公"] },
  { title: "学习计划生成器", goal: "根据考试/课程目标与可用时间，输出分阶段学习计划。", tags: ["学习", "计划", "效率"] },
  { title: "英语写作润色", goal: "润色用户英文文本，提升语法准确性与表达自然度。", tags: ["学习", "英语", "写作"] },
  { title: "单词卡片生成", goal: "根据主题生成单词表，并给出例句与中文释义。", tags: ["学习", "英语", "词汇"] },
  { title: "论文阅读摘要", goal: "输入论文摘要或正文，输出关键贡献与方法概要。", tags: ["学习", "科研", "总结"] },
  { title: "知识点问答助手", goal: "用户输入问题，先在知识库检索，再给出引用式回答。", tags: ["学习", "RAG", "问答"] },
  { title: "课程笔记整理", goal: "将课堂笔记整理成结构化提纲和复习要点。", tags: ["学习", "笔记", "整理"] },
  { title: "编程学习路线", goal: "根据用户目标和基础，生成分阶段编程学习路线。", tags: ["学习", "编程", "规划"] },
  { title: "简历优化助手", goal: "根据岗位描述优化简历要点与措辞。", tags: ["求职", "简历", "写作"] },
  { title: "面试模拟问答", goal: "根据岗位生成面试问题清单和参考回答框架。", tags: ["求职", "面试", "训练"] },
  { title: "个人预算管理", goal: "用户输入月收入/支出，输出预算分配与节省建议。", tags: ["个人", "理财", "预算"] },
  { title: "购物清单排序", goal: "根据预算和优先级对购物清单进行排序。", tags: ["生活", "购物", "清单"] },
  { title: "健身计划助手", goal: "根据目标和时间，生成一周健身安排与注意事项。", tags: ["健康", "运动", "计划"] },
  { title: "饮食健康餐单", goal: "根据热量目标和偏好生成一周餐单。", tags: ["健康", "饮食", "计划"] },
  { title: "习惯打卡助手", goal: "设置习惯目标并生成每日打卡提示与反馈。", tags: ["效率", "习惯", "管理"] },
  { title: "情绪日记分析", goal: "用户记录情绪日记，输出情绪趋势与建议。", tags: ["生活", "情绪", "分析"] },
  { title: "生日祝福生成", goal: "根据对象关系与风格生成个性化祝福文案。", tags: ["生活", "文案", "好玩"] },
  { title: "社媒文案生成", goal: "根据产品/活动信息生成多版本社媒文案。", tags: ["内容", "营销", "文案"] },
  { title: "PPT 大纲生成", goal: "根据主题生成 PPT 结构大纲与每页要点。", tags: ["办公", "PPT", "结构"] },
  { title: "报销材料清单", goal: "根据报销类型生成材料清单与注意事项。", tags: ["办公", "报销", "清单"] },
  { title: "合同条款风险提示", goal: "读取合同要点并提示潜在风险与注意事项。", tags: ["办公", "法务", "RAG"] },
  { title: "旅行费用估算", goal: "用户输入目的地与天数，估算住宿/交通/餐饮费用。", tags: ["旅行", "预算", "计算"] },
  { title: "海报生成助手", goal: "根据活动信息生成海报文案并调用图片生成。", tags: ["设计", "海报", "图像"] },
  { title: "读书摘录整理", goal: "整理读书摘录并生成摘要与行动要点。", tags: ["学习", "读书", "总结"] },
  { title: "观影推荐助手", goal: "根据用户偏好推荐电影并给出推荐理由。", tags: ["娱乐", "推荐", "好玩"] },
  { title: "智能学习测验", goal: "根据学习内容自动生成测验题并给出答案解析。", tags: ["学习", "测验", "评估"] },
];

function buildSystemPrompt() {
  return `你是 Flash Flow Agent，负责生成高质量的工作流 JSON。

要求：
- 只输出 JSON，不要 Markdown，不要解释。
- 必须包含 title、nodes、edges。
- 节点必须有 id、type、data.label。
- 至少包含 Input、LLM、Output 节点。
- LLM 节点必须包含 model、systemPrompt、inputMappings.user_input。
- Output 节点必须包含 inputMappings（优先 select/direct）。
- 变量引用必须使用 {{节点Label.field}} 或 {{node_id.field}}，并确保上游存在。
- 禁止在 Output 的 template 中使用 Handlebars 逻辑。
- 拓扑必须无环、无自环。
- 节点数量不少于 3。

${CORE_RULES}

${NODE_REFERENCE}

${VARIABLE_RULES}

${EDGE_RULES}`;
}

function buildUserPrompt(seed: FlowSeed) {
  return `业务目标：${seed.goal}

请基于目标设计一个可执行的工作流 JSON，注意：
- 节点数量尽量精简但完整
- 必要时使用 tool/rag/imagegen/branch
- 输出适合普通用户使用
- 标题要清晰表达用途`;
}

function buildRepairPrompt(seed: FlowSeed, workflowJson: any) {
  return `你是工作流修复器。根据业务目标修复以下工作流 JSON，使其满足所有规则并可执行。

业务目标：${seed.goal}

修复要求：
- 必须包含 Input、LLM、Output 节点
- LLM 必须有 model、systemPrompt、inputMappings.user_input
- Output 必须有 inputMappings（prefer select/direct）
- 变量引用必须存在上游节点
- 拓扑无环

待修复 JSON：
${JSON.stringify(workflowJson, null, 2)}

只输出修复后的 JSON，不要解释。`;
}

function parseJsonFromModel(raw: string) {
  const extracted = extractBalancedJson(raw) || raw.trim();
  return JSON.parse(extracted);
}

function validateWorkflow(workflow: any) {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow?.edges) ? workflow.edges : [];
  const report = validateGeneratedWorkflowV1_2(nodes, edges);
  return { report, nodes, edges };
}

function hasRequiredNodes(nodes: any[]) {
  const types = new Set(nodes.map((n) => String(n?.type || "").toLowerCase()));
  return types.has("input") && types.has("llm") && types.has("output");
}

function buildFallbackWorkflow(seed: FlowSeed, modelName: string, base?: any) {
  const workflow = base && typeof base === "object" ? { ...base } : {};
  const nodes: any[] = Array.isArray(workflow.nodes) ? [...workflow.nodes] : [];
  const edges: any[] = Array.isArray(workflow.edges) ? [...workflow.edges] : [];

  const usedIds = new Set(nodes.map((n) => n?.id).filter(Boolean));
  const uniqueId = (baseId: string) => {
    let id = baseId;
    let i = 1;
    while (usedIds.has(id)) {
      id = `${baseId}_${i}`;
      i += 1;
    }
    usedIds.add(id);
    return id;
  };

  let inputId = nodes.find((n) => n?.type === "input")?.id as string | undefined;
  if (!inputId) {
    inputId = uniqueId("input_1");
    nodes.unshift({
      id: inputId,
      type: "input",
      data: {
        label: "用户输入",
        enableTextInput: true,
        textRequired: true,
      },
    });
  }

  let llmId = nodes.find((n) => n?.type === "llm")?.id as string | undefined;
  if (!llmId) {
    llmId = uniqueId("llm_1");
    nodes.push({
      id: llmId,
      type: "llm",
      data: {
        label: "任务处理",
        model: modelName,
        systemPrompt: `你是一个专业助手。目标：${seed.goal}。请根据用户输入生成结果。`,
        temperature: 0.4,
        inputMappings: { user_input: `{{${inputId}.user_input}}` },
      },
    });
  }

  let outputId = nodes.find((n) => n?.type === "output")?.id as string | undefined;
  if (!outputId) {
    outputId = uniqueId("output_1");
    nodes.push({
      id: outputId,
      type: "output",
      data: {
        label: "最终输出",
        inputMappings: {
          mode: "select",
          sources: [{ type: "variable", value: `{{${llmId}.response}}` }],
        },
      },
    });
  }

  const edgeKey = (s: string, t: string) => `${s}::${t}`;
  const edgeSet = new Set(edges.map((e) => edgeKey(e?.source, e?.target)));
  const pushEdge = (source: string, target: string) => {
    const key = edgeKey(source, target);
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ id: `edge_${source}_${target}`, source, target });
  };

  pushEdge(inputId, llmId);
  pushEdge(llmId, outputId);

  return {
    title: workflow.title || seed.title,
    nodes,
    edges,
  };
}

async function main() {
  loadEnv();

  const args = new Set(process.argv.slice(2));
  const countArg = [...args].find((arg) => arg.startsWith("--count="));
  const dirArg = [...args].find((arg) => arg.startsWith("--dir="));
  const overwrite = args.has("--overwrite");
  const autoSeed = args.has("--seed");
  const seedCategoryArg = [...args].find((arg) => arg.startsWith("--seed-category="));
  const maxAttemptsArg = [...args].find((arg) => arg.startsWith("--max-attempts="));

  const count = countArg ? Number(countArg.split("=")[1]) : 30;
  const maxAttempts = maxAttemptsArg
    ? Number(maxAttemptsArg.split("=")[1])
    : Number(process.env.FLOW_CASE_MAX_ATTEMPTS || 3);
  const timeoutMs = Number(process.env.FLOW_CASE_TIMEOUT_MS || 60000);

  const dir = dirArg ? dirArg.split("=")[1] : path.join(ROOT, "docs", "flow-cases", "auto");
  ensureDir(dir);

  const modelName =
    process.env.FLOW_CASE_MODEL ||
    process.env.DEFAULT_LLM_MODEL ||
    "deepseek-v3.2";
  const provider = getProviderForModel(modelName);
  const config = PROVIDER_CONFIG[provider];
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new Error(`Missing API key for provider ${provider}`);
  }

  const client = new OpenAI({ apiKey, baseURL: config.baseURL });
  const systemPrompt = buildSystemPrompt();

  const seeds = DEFAULT_SEEDS.slice(0, Math.min(count, DEFAULT_SEEDS.length));
  if (seeds.length === 0) {
    console.log("No seeds available.");
    return;
  }

  let successCount = 0;

  const createCompletion = async (messages: Array<{ role: "system" | "user"; content: string }>, temperature: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await client.chat.completions.create(
        {
          model: modelName,
          temperature,
          messages,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  };

  for (let i = 0; i < seeds.length; i += 1) {
    const seed = seeds[i];
    const slug = slugify(seed.title) || `flow-case-${i + 1}`;
    const filePath = path.join(dir, `auto-${slug}-${i + 1}.json`);

    if (!overwrite && fs.existsSync(filePath)) {
      console.log(`Skip (exists): ${filePath}`);
      continue;
    }

    let attempt = 0;
    let finalWorkflow: any = null;
    let lastError: string | null = null;

    while (attempt < maxAttempts && !finalWorkflow) {
      attempt += 1;
      try {
        console.log(`Generating (${seed.title}) attempt ${attempt}/${maxAttempts}...`);
        const completion = await createCompletion(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildUserPrompt(seed) },
          ],
          0.2
        );

        const raw = completion.choices?.[0]?.message?.content || "";
        let workflow = parseJsonFromModel(raw);
        if (!workflow?.title) workflow.title = seed.title;

        let { report, nodes, edges } = validateWorkflow(workflow);
        if (report.hardErrors.length > 0) {
          const fixed = deterministicFixWorkflowV1(nodes, edges, {
            includeInputOutput: true,
            safeFixOptions: {
              removeInvalidEdges: true,
              dedupeEdges: true,
              ensureEdgeIds: true,
              replaceVariableIdPrefixToLabel: true,
            },
          });
          const recheck = validateGeneratedWorkflowV1_2(fixed.nodes, fixed.edges);
          if (recheck.hardErrors.length === 0) {
            workflow = { ...workflow, nodes: fixed.nodes, edges: fixed.edges };
            report = recheck;
          }
        }

        const nodeCount = Array.isArray(workflow.nodes) ? workflow.nodes.length : 0;
        const llmCount = Array.isArray(workflow.nodes)
          ? workflow.nodes.filter((n: any) => n?.type === "llm").length
          : 0;

        if (report.hardErrors.length === 0 && nodeCount >= 3 && llmCount >= 1 && hasRequiredNodes(workflow.nodes)) {
          finalWorkflow = workflow;
        } else {
          // Try repair once per attempt
          const repair = await createCompletion(
            [
              { role: "system", content: buildSystemPrompt() },
              { role: "user", content: buildRepairPrompt(seed, workflow) },
            ],
            0
          );
          const repairedRaw = repair.choices?.[0]?.message?.content || "";
          let repaired = parseJsonFromModel(repairedRaw);
          if (!repaired?.title) repaired.title = seed.title;
          const repairedReport = validateGeneratedWorkflowV1_2(repaired.nodes || [], repaired.edges || []);
          const repairedNodeCount = Array.isArray(repaired.nodes) ? repaired.nodes.length : 0;
          const repairedLlmCount = Array.isArray(repaired.nodes)
            ? repaired.nodes.filter((n: any) => n?.type === "llm").length
            : 0;
          if (repairedReport.hardErrors.length === 0 && repairedNodeCount >= 3 && repairedLlmCount >= 1 && hasRequiredNodes(repaired.nodes)) {
            finalWorkflow = repaired;
          } else {
            lastError = repairedReport.hardErrors.map((e) => `${e.code}:${e.message}`).join("; ");
          }
        }

        if (!finalWorkflow && attempt === maxAttempts) {
          const fallback = buildFallbackWorkflow(seed, modelName, workflow);
          const fallbackReport = validateGeneratedWorkflowV1_2(fallback.nodes || [], fallback.edges || []);
          if (fallbackReport.hardErrors.length === 0) {
            finalWorkflow = fallback;
          } else {
            lastError = fallbackReport.hardErrors.map((e) => `${e.code}:${e.message}`).join("; ");
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!finalWorkflow) {
      console.log(`Failed: ${seed.title} (${lastError || "unknown error"})`);
      continue;
    }

    const payload = {
      title: seed.title,
      goal: seed.goal,
      tags: seed.tags,
      workflow: {
        title: finalWorkflow.title || seed.title,
        nodes: finalWorkflow.nodes,
        edges: finalWorkflow.edges,
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    successCount += 1;
    console.log(`Generated (${successCount}/${seeds.length}): ${seed.title}`);
  }

  console.log(`Done. Generated ${successCount} cases to ${dir}`);

  if (autoSeed) {
    const { execSync } = await import("child_process");
    const seedCategory = seedCategoryArg ? seedCategoryArg.split("=")[1] : "flow_case";
    console.log("Seeding generated cases to agent_docs...");
    execSync(`npm run seed:flow-cases -- --truncate --dir=${dir} --category=${seedCategory}`, {
      stdio: "inherit",
    });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
