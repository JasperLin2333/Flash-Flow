import OpenAI from "openai";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";

/**
 * Intent Recognition Module (SOP V3.1 - Conservative Strategy)
 *
 * Combines Flash Flow's routing layer with Coze's structured clarification approach.
 * CRITICAL: Only use DIRECT_MODE when 85%+ confident in understanding TRUE user intent.
 *
 * Key Features:
 * - Strict completeness check (Action + Object + Execution Details)
 * - clarify_dimensions: tells frontend WHICH questions to ask
 * - High threshold for DIRECT_MODE (need execution-ready clarity)
 */

const INTENT_RECOGNITION_PROMPT_V3 = `你是一个工作流意图分析器。请使用以下 SOP 判断用户需求是否**完全明确到可以直接执行**。

## 核心原则
⚠️ **只有当你有 85% 以上的把握理解用户的真实需求时，才判定为 DIRECT_MODE。**
宁可多问一句，也不要猜错用户意图。

## 判断 SOP

### Step 1: 三要素检测

| 要素 | 说明 | 示例（有） | 示例（缺失） |
|------|------|-----------|-------------|
| **动作** | 明确的操作 | 翻译、总结、搜索 | "处理"、"优化" |
| **对象** | 处理目标 | 文章、PDF、网页 | "这个"、"东西" |
| **细节** | 执行参数 | 翻译成英文、专业风格 | 只说"翻译" |

### Step 2: DIRECT_MODE 严格条件（必须同时满足）
✅ 有明确动作词（非模糊词如"处理/优化/改一下"）
✅ 有明确对象（知道操作什么）
✅ 核心执行细节清晰（如：目标语言、输出格式、风格要求）
✅ 你能用一句话准确复述用户的完整需求

### Step 3: 需要 PLAN_MODE 的情况
❌ 动作模糊："帮我处理一下"、"优化一下"、"弄个什么"
❌ 对象模糊："翻译这个"（什么东西？）
❌ 细节缺失："翻译这篇文章"（翻译成什么语言？什么风格？）
❌ 歧义场景："做个助手"（什么类型的助手？）

### Step 4: 澄清维度
- **功能**：想做什么操作？
- **输入**：处理什么内容？（文本/文件/URL）
- **输出**：期望什么结果？（格式、风格）
- **细节**：有什么特殊要求？（语言、领域、长度）

## 示例判断

| 用户输入 | 判定 | 理由 | 缺失维度 |
|---------|------|------|---------|
| "把这篇中文文章翻译成英文，保持专业学术风格" | DIRECT | 动作+对象+语言+风格全明确 | [] |
| "翻译这篇文章" | PLAN | 缺少目标语言和风格 | ["细节"] |
| "翻译" | PLAN | 只有动作，缺对象和细节 | ["输入", "细节"] |
| "帮我做个工作流" | PLAN | 全部模糊 | ["功能", "输入", "输出"] |
| "总结这个PDF的核心观点，输出5条要点" | DIRECT | 动作+对象+格式要求明确 | [] |

## 输出格式

严格输出以下 JSON：
{
  "mode": "PLAN_MODE" 或 "DIRECT_MODE",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由（说明缺什么或为什么足够明确）",
  "detected_action": "检测到的动作词（如有）",
  "detected_object": "检测到的对象（如有）",
  "detected_details": "检测到的执行细节（如有）",
  "clarify_dimensions": ["需要澄清的维度：功能/输入/输出/细节"]
}`;

export type IntentMode = "PLAN_MODE" | "DIRECT_MODE";
export type ClarifyDimension = "功能" | "输入" | "输出" | "细节";

export interface IntentRecognitionResult {
    mode: IntentMode;
    confidence: "high" | "medium" | "low";
    reasoning?: string;
    detectedAction?: string;
    detectedObject?: string;
    detectedDetails?: string;
    clarifyDimensions?: ClarifyDimension[];
    rawResponse: string;
}

/**
 * Detect user intent to determine whether to use planning mode or direct mode.
 * Uses SOP V3 fusion strategy combining routing + structured clarification.
 *
 * @param prompt - User's input prompt
 * @param modelName - Model to use for classification (defaults to deepseek-v3.2)
 * @returns Intent recognition result with clarification dimensions
 */
export async function detectUserIntent(
    prompt: string,
    modelName: string = process.env.INTENT_RECOGNITION_MODEL || process.env.DEFAULT_LLM_MODEL || "deepseek-v3.2"
): Promise<IntentRecognitionResult> {
    const provider = getProviderForModel(modelName);
    const config = PROVIDER_CONFIG[provider];

    const client = new OpenAI({
        apiKey: config.getApiKey(),
        baseURL: config.baseURL,
    });

    try {
        const completion = await client.chat.completions.create({
            model: modelName,
            temperature: 0.1, // Low temperature for consistent classification
            max_tokens: 300,  // Allow room for structured output
            messages: [
                { role: "system", content: INTENT_RECOGNITION_PROMPT_V3 },
                { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
        });

        const rawResponse = completion.choices[0]?.message?.content?.trim() || "{}";

        try {
            const parsed = JSON.parse(rawResponse);

            // Validate and extract fields
            const mode: IntentMode = parsed.mode === "DIRECT_MODE" ? "DIRECT_MODE" : "PLAN_MODE";
            const confidenceScore = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
            const confidence: "high" | "medium" | "low" =
                confidenceScore >= 0.8 ? "high" :
                    confidenceScore >= 0.5 ? "medium" : "low";

            // Extract clarify dimensions
            const clarifyDimensions: ClarifyDimension[] = Array.isArray(parsed.clarify_dimensions)
                ? parsed.clarify_dimensions.filter((d: string) =>
                    ["功能", "输入", "输出", "能力"].includes(d)
                )
                : [];

            console.log(`[IntentRecognition V3] ${mode} (${confidence}) - ${parsed.reasoning || "No reasoning"}`);
            if (clarifyDimensions.length > 0) {
                console.log(`[IntentRecognition V3] Clarify dimensions: ${clarifyDimensions.join(", ")}`);
            }

            return {
                mode,
                confidence,
                reasoning: parsed.reasoning,
                detectedAction: parsed.detected_action,
                detectedObject: parsed.detected_object,
                clarifyDimensions,
                rawResponse,
            };
        } catch {
            // JSON parse failed, fallback to text parsing
            console.warn("[IntentRecognition V3] JSON parse failed, falling back:", rawResponse);
            const normalizedResponse = rawResponse.toUpperCase();

            let mode: IntentMode = "PLAN_MODE";
            if (normalizedResponse.includes("DIRECT_MODE")) {
                mode = "DIRECT_MODE";
            }

            return {
                mode,
                confidence: "low",
                clarifyDimensions: ["功能", "输入", "输出"],
                rawResponse,
            };
        }
    } catch (error) {
        console.error("[IntentRecognition V3] Error during intent detection:", error);
        // On error, default to PLAN_MODE with all dimensions (safer option)
        return {
            mode: "PLAN_MODE",
            confidence: "low",
            clarifyDimensions: ["功能", "输入", "输出", "细节"],
            rawResponse: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Generate clarification questions based on the detected dimensions.
 * Used by the planning mode to ask targeted questions.
 */
export function generateClarificationQuestions(dimensions: ClarifyDimension[]): string[] {
    const questionMap: Record<ClarifyDimension, string> = {
        "功能": "你希望这个工作流做什么？（如：翻译、总结、搜索、生成图片）",
        "输入": "输入是什么形式？（如：文本、文件、URL、语音）",
        "输出": "期望输出什么？（如：文本回复、结构化数据、发送通知）",
        "细节": "有什么特殊要求？（如：目标语言、输出格式、风格偏好）",
    };

    return dimensions.map(dim => questionMap[dim]).filter(Boolean);
}
