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
        description: "把一段文字翻译成另一种语言的流程",
        tips: [
            "把“创意程度（temperature）”调低（如 0.3），翻译更稳定、更准确",
            "在“系统提示词（systemPrompt）”里写清楚源语言和目标语言",
            "遇到行业术语，先给出术语表或领域背景（写在系统提示词里）",
            "对重要内容，建议加一步“人工确认/审核”"
        ],
        recommendedNodes: ["input", "llm", "output"],
        commonMistakes: [
            "创意程度（temperature）过高（>0.5）导致译文风格漂移",
            "没有明确目标语言，输出不一致",
            "长文本不分段，容易漏译或断句不自然"
        ],
        suggestedImprovements: [
            "增加分支节点：重要内容走“人工确认”，普通内容自动通过",
            "用结构化输出（如 JSON）同时返回“原文 + 译文”，便于后续处理"
        ]
    },

    "内容生成": {
        description: "生成文章、文案、摘要等内容的流程",
        tips: [
            "创意写作：把创意程度（temperature）调高（如 0.7–0.9），更有想法",
            "结构化内容（摘要/报告）：把创意程度调低（如 0.3–0.5），更稳更准",
            "在系统提示词里写清楚风格、字数、格式要求（越具体越好）",
            "需要“标题/要点/正文”等固定结构时，用结构化输出（如 JSON）更省心"
        ],
        recommendedNodes: ["input", "llm", "output"],
        commonMistakes: [
            "系统提示词太泛，没写清楚风格和格式",
            "没给字数/长度上限，输出容易跑题或过长",
            "创意内容把创意程度调得太低，结果太“平”"
        ],
        suggestedImprovements: [
            "增加联网搜索工具，先找资料再写，内容更“新”",
            "拆成两步：先生成草稿，再润色/改写，提高质量和一致性"
        ]
    },

    "图片生成": {
        description: "根据文字描述生成图片的流程",
        tips: [
            "把提示词写具体：主体、风格、镜头、光线、构图（越清楚越接近预期）",
            "用负面提示词（negativePrompt）明确“不想要什么”，减少翻车",
            "选模型时先对齐风格：写实/插画/唯美等",
            "cfg（提示词遵循度）建议 7–9：既听话又不过度死板"
        ],
        recommendedNodes: ["input", "imagegen", "output"],
        commonMistakes: [
            "不写负面提示词，结果容易出现不想要的元素",
            "提示词太短，没写风格/场景/光线，效果随机",
            "输出节点没带图片附件，导致页面看不到图"
        ],
        suggestedImprovements: [
            "加一步“提示词优化”：先把用户描述改写成更可控的提示词",
            "在输出节点把生成的图片链接作为附件输出，便于展示和下载"
        ]
    },

    "知识问答": {
        description: "基于知识库资料进行问答的流程（先检索，再回答）",
        tips: [
            "知识库检索（RAG）建议把分段大小调到 500–1000，命中率更好",
            "在系统提示词里强调：只根据检索到的资料回答，避免编造",
            "如果要让用户上传资料，记得开启“文件上传”输入"
        ],
        recommendedNodes: ["input", "rag", "llm", "output"],
        commonMistakes: [
            "检索节点没收到查询内容（query）",
            "回答节点没用上检索结果，导致答非所问",
            "文件来源配置错，导致找不到资料"
        ],
        suggestedImprovements: [
            "加一个分支：如果没检索到资料，就提示用户换关键词或补充信息"
        ]
    },

    "条件判断": {
        description: "根据条件走不同路径的流程（分支）",
        tips: [
            "条件表达式尽量写清楚、可读（能一眼看懂）",
            "Branch 条件只能用白名单语法（includes/startsWith/endsWith/===/!==/>/< 等）",
            "条件复杂时，先让 AI 输出结构化判断结果（如 JSON 的 true/false），再走分支",
            "确保“是/否”两条分支都连上后续步骤，避免漏路"
        ],
        recommendedNodes: ["input", "llm", "branch", "llm", "output"],
        commonMistakes: [
            "条件表达式写错，导致无法判断",
            "分支线没标清“是/否”，导致走错路",
            "只连了“是”的分支，忘了“否”的分支"
        ],
        suggestedImprovements: [
            "先输出 {\"result\": true/false} 这类结构化结果，再用它做分支判断"
        ]
    },

    "数据处理": {
        description: "做计算、转换、格式化等数据处理的流程",
        tips: [
            "复杂计算/清洗数据，优先用代码执行工具（更可靠）",
            "需要后续步骤引用特定字段时，用结构化输出（如 JSON）更清晰",
            "简单四则运算，用计算工具更直接"
        ],
        recommendedNodes: ["input", "tool", "llm", "output"],
        commonMistakes: [
            "工具节点参数没填对，导致执行失败",
            "把复杂数据处理交给纯文本生成，结果不稳定"
        ],
        suggestedImprovements: [
            "多步处理拆开做：每一步都可验证，出错也更好排查"
        ]
    },

    "综合": {
        description: "组合多种能力的复杂流程",
        tips: [
            "先把主流程跑通，再加辅助功能",
            "用分支处理异常和边界情况（空输入、失败重试等）",
            "节点尽量少而清晰（建议 10 个以内）"
        ],
        recommendedNodes: ["input", "llm", "branch", "tool", "output"],
        commonMistakes: [
            "节点堆太多，流程难理解也难维护",
            "引用链太长，容易引用错字段",
            "没有异常处理分支，出错时用户无反馈"
        ],
        suggestedImprovements: [
            "关键环节加人工确认",
            "补齐错误处理分支（失败提示、重试或降级）"
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
