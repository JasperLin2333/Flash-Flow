import { NextResponse } from "next/server";
export const runtime = 'edge';
import OpenAI from "openai";
import { PROVIDER_CONFIG, getProviderForModel } from "@/lib/llmProvider";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/authEdge";

/**
 * 意图分类 API
 * 使用小模型快速分类用户的修改意图
 * 
 * 设计目标：
 * - 快速响应（100-300ms）
 * - 低成本（使用小模型）
 * - 高准确率分类
 */

const CLASSIFICATION_PROMPT = `你是一个工作流修改意图分类器。根据用户输入，快速判断他们想要执行的操作类型。

# 分类规则

| 意图类型 | 典型表述 | 示例 |
|---------|---------|------|
| modify_attribute | 修改现有节点的属性 | "开启记忆"、"温度调低"、"改用gpt-4" |
| add_node | 添加新节点 | "加个搜索"、"插入一个分支"、"添加图片生成" |
| delete_node | 删除节点 | "删掉XX节点"、"移除分支"、"去掉工具" |
| restructure | 重构整个流程 | "改成并行"、"重新设计"、"串联改并联" |

# 输出格式
严格输出 JSON：
{
  "intent": "modify_attribute" | "add_node" | "delete_node" | "restructure",
  "confidence": 0.0-1.0,
  "targetNodeHint": "用户提到的节点名称或关键词（如有）",
  "targetNodeType": "llm" | "input" | "output" | "branch" | "tool" | "rag" | "imagegen" | null
}

# 用户输入
`;

export async function POST(req: Request) {
    try {
        // Authentication check
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return unauthorizedResponse();
        }

        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
        }

        // 使用小模型进行分类
        // 优先使用快速模型：gpt-4o-mini > deepseek-chat > 默认模型
        const classifyModel = process.env.CLASSIFY_MODEL ||
            process.env.DEFAULT_LLM_MODEL ||
            "deepseek-ai/DeepSeek-V3.2";

        const provider = getProviderForModel(classifyModel);
        const config = PROVIDER_CONFIG[provider];

        const client = new OpenAI({
            apiKey: config.getApiKey(),
            baseURL: config.baseURL
        });

        const completion = await client.chat.completions.create({
            model: classifyModel,
            temperature: 0,  // 确定性输出
            max_tokens: 200, // 限制输出长度，加速响应
            messages: [
                {
                    role: "system",
                    content: CLASSIFICATION_PROMPT + prompt
                },
                {
                    role: "user",
                    content: "请分类并输出 JSON。"
                },
            ],
            response_format: { type: "json_object" },
        });

        const content = completion.choices?.[0]?.message?.content || "{}";

        try {
            const result = JSON.parse(content);

            // 验证必要字段
            if (!result.intent || typeof result.confidence !== "number") {
                return NextResponse.json({
                    intent: "unknown",
                    confidence: 0,
                    targetNodeHint: null,
                    targetNodeType: null
                });
            }

            return NextResponse.json(result);
        } catch {
            // JSON 解析失败
            return NextResponse.json({
                intent: "unknown",
                confidence: 0,
                targetNodeHint: null,
                targetNodeType: null
            });
        }
    } catch (e) {
        if (process.env.NODE_ENV === 'development') {
            console.error("Classify intent error:", e);
        }
        return NextResponse.json({
            intent: "unknown",
            confidence: 0,
            error: "Classification failed"
        }, { status: 500 });
    }
}
