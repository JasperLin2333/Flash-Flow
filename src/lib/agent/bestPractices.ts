/**
 * Best Practices Knowledge Base for Agent Phase 3
 * 
 * 场景化的最佳实践数据，用于 Agent 主动建议功能。
 */

export interface BestPractice {
    description: string;
    tips: string[];
    recommendedNodes: string[];
    commonMistakes: string[];
    suggestedImprovements: string[];
}

export type ScenarioType =
    | "翻译"
    | "内容生成"
    | "图片生成"
    | "知识问答"
    | "条件判断"
    | "数据处理"
    | "综合";

export const BEST_PRACTICES: Record<ScenarioType, BestPractice> = {
    "翻译": {
        description: "多语言翻译工作流，将文本从一种语言翻译为另一种语言",
        tips: [
            "使用 temperature=0.3 提高翻译一致性和准确性",
            "在 systemPrompt 中明确指定源语言和目标语言",
            "对于专业术语，在 systemPrompt 中提供术语表或领域说明",
            "考虑添加人工审核节点以保证翻译质量"
        ],
        recommendedNodes: ["input", "llm", "output"],
        commonMistakes: [
            "temperature 设置过高（>0.5）导致翻译不稳定",
            "未明确指定目标语言",
            "未处理长文本分段问题"
        ],
        suggestedImprovements: [
            "添加 Branch 节点实现人工审核流程",
            "使用 JSON 模式输出结构化翻译结果（原文 + 译文）"
        ]
    },

    "内容生成": {
        description: "AI 辅助的内容创作工作流，包括文章、文案、摘要等",
        tips: [
            "temperature=0.7-0.9 适合创意写作",
            "temperature=0.3-0.5 适合结构化内容（如摘要、报告）",
            "使用详细的 systemPrompt 指定写作风格、字数要求",
            "考虑使用 JSON 模式输出结构化内容（标题、正文、摘要等）"
        ],
        recommendedNodes: ["input", "llm", "output"],
        commonMistakes: [
            "systemPrompt 过于简单，缺少风格和格式要求",
            "未指定输出长度限制",
            "创意内容使用过低的 temperature"
        ],
        suggestedImprovements: [
            "添加 Tool 节点（web_search）获取最新信息作为素材",
            "使用多个 LLM 节点实现「生成-润色」两阶段流程"
        ]
    },

    "图片生成": {
        description: "AI 图片生成工作流，根据文字描述生成图像",
        tips: [
            "提供详细的正向提示词（prompt），描述主体、风格、光线等",
            "使用负面提示词（negativePrompt）排除不想要的元素",
            "Kolors 模型适合唯美风格，Qwen 模型适合写实风格",
            "cfg 值 7-9 平衡提示词遵循度和创意性"
        ],
        recommendedNodes: ["input", "imagegen", "output"],
        commonMistakes: [
            "未使用 negativePrompt 导致生成效果不可控",
            "提示词过于简单，缺少风格描述",
            "Output 节点未配置 attachments 导致图片无法显示"
        ],
        suggestedImprovements: [
            "添加 LLM 节点优化用户输入为高质量提示词",
            "在 Output 节点的 attachments 中正确引用 {{ImageGen.imageUrl}}"
        ]
    },

    "知识问答": {
        description: "基于知识库的问答工作流，结合 RAG 检索增强生成",
        tips: [
            "RAG 节点的 maxTokensPerChunk 建议 500-1000",
            "在 LLM 节点的 systemPrompt 中明确指示「只根据检索内容回答」",
            "启用 Input 节点的 enableFileInput 支持用户上传文档"
        ],
        recommendedNodes: ["input", "rag", "llm", "output"],
        commonMistakes: [
            "未配置 RAG 节点的 inputMappings.query",
            "LLM 节点未引用 {{RAG.documents}} 导致检索结果被忽略",
            "fileMode 配置错误（variable vs static）"
        ],
        suggestedImprovements: [
            "添加 Branch 节点判断检索结果是否为空，空则提示用户重新提问"
        ]
    },

    "条件判断": {
        description: "包含分支逻辑的工作流，根据条件执行不同路径",
        tips: [
            "Branch 节点的 condition 使用清晰的比较表达式",
            "复杂条件建议让 LLM 用 JSON 模式输出结构化判断结果",
            "确保 true 和 false 两个分支都有正确的边连接"
        ],
        recommendedNodes: ["input", "llm", "branch", "llm", "output"],
        commonMistakes: [
            "condition 表达式语法错误",
            "缺少 sourceHandle 导致边连接错误",
            "只连接了 true 分支，忘记 false 分支"
        ],
        suggestedImprovements: [
            "使用 LLM JSON 模式输出 {\"result\": true/false} 而非自由文本判断"
        ]
    },

    "数据处理": {
        description: "数据转换、计算、格式化等处理工作流",
        tips: [
            "使用 Tool 节点的 code_interpreter 处理复杂计算",
            "JSON 模式输出便于后续节点引用特定字段",
            "考虑使用 calculator 工具处理简单数学运算"
        ],
        recommendedNodes: ["input", "tool", "llm", "output"],
        commonMistakes: [
            "未正确配置 Tool 节点的 inputs 参数",
            "复杂数据处理应使用 Tool 而非 LLM"
        ],
        suggestedImprovements: [
            "对于多步骤处理，拆分为多个 Tool/LLM 节点"
        ]
    },

    "综合": {
        description: "复杂的多功能工作流，组合多种能力",
        tips: [
            "先明确核心流程，再添加辅助功能",
            "使用 Branch 节点处理错误和边界情况",
            "建议总节点数控制在 10 个以内"
        ],
        recommendedNodes: ["input", "llm", "branch", "tool", "output"],
        commonMistakes: [
            "节点过多导致流程混乱",
            "变量引用链过长容易出错",
            "缺少错误处理分支"
        ],
        suggestedImprovements: [
            "添加人工审核节点",
            "添加错误处理分支"
        ]
    }
};

// ============ Intent Detection Keywords ============
export const INTENT_KEYWORDS: Record<ScenarioType, string[]> = {
    "翻译": ["翻译", "translate", "转成", "转为", "英文", "中文", "日文", "韩文", "多语言", "语言转换"],
    "内容生成": ["写", "生成", "创作", "文章", "文案", "摘要", "总结", "报告", "内容"],
    "图片生成": ["图片", "图像", "绘", "画", "生成图", "图片生成", "插画", "头像"],
    "知识问答": ["知识库", "问答", "RAG", "检索", "文档", "查找", "搜索知识"],
    "条件判断": ["判断", "分支", "如果", "条件", "是否", "根据", "分类"],
    "数据处理": ["计算", "统计", "分析", "处理", "转换", "格式化", "提取"],
    "综合": []  // Fallback
};

/**
 * 根据用户输入检测意图类型
 */
export function detectIntentFromPrompt(prompt: string): ScenarioType {
    const lowercasePrompt = prompt.toLowerCase();

    let bestMatch: ScenarioType = "综合";
    let maxScore = 0;

    for (const [scenario, keywords] of Object.entries(INTENT_KEYWORDS)) {
        if (scenario === "综合") continue;

        let score = 0;
        for (const keyword of keywords) {
            if (lowercasePrompt.includes(keyword.toLowerCase())) {
                score += 2;
            }
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = scenario as ScenarioType;
        }
    }

    return bestMatch;
}

/**
 * 根据场景获取主动建议
 */
export function getProactiveSuggestions(scenario: ScenarioType): string[] {
    const practice = BEST_PRACTICES[scenario];
    if (!practice) return [];

    return practice.suggestedImprovements;
}
