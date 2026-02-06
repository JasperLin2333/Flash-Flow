import OpenAI from "openai";

import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import type { SkillDefinition } from "@/lib/skills/skillRegistry";
import { BEST_PRACTICES, detectIntentFromPrompt, type ScenarioType } from "@/lib/agent/bestPractices";
import type { ClarifyDimension } from "@/lib/agent/intentRecognition";

const SCENARIOS = Object.keys(BEST_PRACTICES) as ScenarioType[];
const CLARIFY_DIMENSIONS: ClarifyDimension[] = ["功能", "输入", "输出", "细节"];

const DEFAULT_FALLBACK_SCENARIO: ScenarioType = "综合";

interface SkillCard {
  id: string;
  name: string;
  description: string;
  domains: string[];
  tags: string[];
  isDefault: boolean;
  priority: number;
}

export interface AgentSkillRoutingResult {
  scenario: ScenarioType;
  skillIds: string[];
  confidence: number;
  clarifyDimensions: ClarifyDimension[];
  reason?: string;
  rawResponse: string;
}

export interface AgentSkillRoutingOptions {
  modelName?: string;
  maxSkills?: number;
}

function parseCsv(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value?: string) {
  if (!value) return false;
  return ["true", "1", "yes", "y", "on"].includes(value.toLowerCase());
}

function parseNumber(value?: string, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toSkillCard(skill: SkillDefinition): SkillCard {
  const domains = parseCsv(skill.frontmatter.domains || skill.frontmatter.domain);
  const tags = parseCsv(skill.frontmatter.tags || skill.frontmatter.tag);
  const isDefault = parseBoolean(
    skill.frontmatter.default || skill.frontmatter.common || skill.frontmatter.auto
  );
  const priority = parseNumber(skill.frontmatter.priority || skill.frontmatter.rank, 0);

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    domains,
    tags,
    isDefault,
    priority,
  };
}

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeScenario(value: unknown, fallback: ScenarioType) {
  if (typeof value === "string" && SCENARIOS.includes(value as ScenarioType)) {
    return value as ScenarioType;
  }
  return fallback;
}

function normalizeClarifyDimensions(value: unknown): ClarifyDimension[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item))
    .filter((item) => CLARIFY_DIMENSIONS.includes(item as ClarifyDimension)) as ClarifyDimension[];
}

export function getDefaultSkillIds(
  skills: SkillDefinition[],
  envDefaults?: string[],
  fallbackCount = 2
) {
  const available = new Set(skills.map((skill) => skill.id));
  const envSelected = (envDefaults || []).filter((id) => available.has(id));
  if (envSelected.length > 0) return envSelected;

  const cards = skills.map(toSkillCard);
  const defaults = cards
    .filter((card) => card.isDefault)
    .sort((a, b) => b.priority - a.priority);
  if (defaults.length > 0) {
    return defaults.map((card) => card.id);
  }

  return cards
    .sort((a, b) => b.priority - a.priority)
    .slice(0, fallbackCount)
    .map((card) => card.id);
}

export async function routeAgentSkills(
  prompt: string,
  skills: SkillDefinition[],
  options: AgentSkillRoutingOptions = {}
): Promise<AgentSkillRoutingResult> {
  const fallbackScenario = detectIntentFromPrompt(prompt) || DEFAULT_FALLBACK_SCENARIO;
  const fallback: AgentSkillRoutingResult = {
    scenario: fallbackScenario,
    skillIds: [],
    confidence: 0,
    clarifyDimensions: [],
    rawResponse: "",
  };

  if (!prompt?.trim() || skills.length === 0) {
    return fallback;
  }

  const modelName =
    options.modelName ||
    process.env.AGENT_SKILL_CLASSIFIER_MODEL ||
    process.env.CLASSIFY_MODEL ||
    process.env.INTENT_RECOGNITION_MODEL ||
    process.env.DEFAULT_LLM_MODEL ||
    "deepseek-v3.2";

  const providedMax =
    typeof options.maxSkills === "number" && Number.isFinite(options.maxSkills)
      ? options.maxSkills
      : undefined;
  const envMax = Number(process.env.AGENT_SKILL_CLASSIFIER_MAX_SKILLS || 3);
  const resolvedMax = providedMax ?? (Number.isFinite(envMax) ? envMax : 3);
  const maxSkills = Math.max(0, Math.min(resolvedMax, 5));

  const cards = skills.map(toSkillCard);
  const skillCatalog = cards
    .map((card) => {
      const domains = card.domains.length > 0 ? card.domains.join("/") : "";
      const tags = card.tags.length > 0 ? card.tags.join("/") : "";
      const defaultMark = card.isDefault ? "default" : "";
      return `- ${card.id} | ${card.name} | ${card.description} | domains: ${domains} | tags: ${tags} | ${defaultMark}`;
    })
    .join("\n");

  const systemPrompt = `你是“工作流生成 Agent”的技能路由器。\n\n任务：根据用户需求，从下列技能中选择最合适的 0-${maxSkills} 个技能。\n\n规则：\n- 如果没有合适技能，skill_ids 为空数组。\n- 如果有多个技能都相关，可以选择多个（最多 ${maxSkills}）。\n- 优先选择标注 default 的技能作为通用补充。\n- 同时输出最匹配的场景 scenario（从给定列表中选一个）。\n- 如果信息不够明确，需要补问，给出 clarify_dimensions（功能/输入/输出/细节），否则空数组。\n\n输出 JSON（只输出 JSON，不要多余文本）：\n{\n  "scenario": "${SCENARIOS.join(" | ")}",\n  "skill_ids": ["skill-id"],\n  "confidence": 0.0-1.0,\n  "clarify_dimensions": ["功能" | "输入" | "输出" | "细节"],\n  "reason": "简短理由"\n}\n\n技能列表：\n${skillCatalog}`;

  try {
    const provider = getProviderForModel(modelName);
    const config = PROVIDER_CONFIG[provider];
    const client = new OpenAI({
      apiKey: config.getApiKey(),
      baseURL: config.baseURL,
    });

    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const rawResponse = completion.choices?.[0]?.message?.content?.trim() || "{}";

    try {
      const parsed = JSON.parse(rawResponse);
      const scenario = normalizeScenario(parsed.scenario, fallbackScenario);
      const confidence = clampConfidence(parsed.confidence);
      const clarifyDimensions = normalizeClarifyDimensions(
        parsed.clarify_dimensions ?? parsed.clarifyDimensions
      );

      const skillIdSet = new Set(cards.map((card) => card.id));
      const rawSkillIds = Array.isArray(parsed.skill_ids)
        ? parsed.skill_ids
        : Array.isArray(parsed.skillIds)
          ? parsed.skillIds
          : Array.isArray(parsed.skills)
            ? parsed.skills
            : [];

      const skillIds = Array.from(
        new Set(
          rawSkillIds
            .map((id: unknown) => String(id).trim())
            .filter((id: string) => skillIdSet.has(id))
        )
      ).slice(0, maxSkills);

      return {
        scenario,
        skillIds,
        confidence,
        clarifyDimensions,
        reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
        rawResponse,
      };
    } catch (error) {
      return {
        ...fallback,
        rawResponse,
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[AgentSkillRouting] Classification failed:", error);
    }
    return fallback;
  }
}
