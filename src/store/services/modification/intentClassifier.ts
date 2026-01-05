/**
 * AI 意图分类器
 * 使用小模型快速分类用户修改意图
 * 
 * 设计原则：
 * - 调用轻量级 AI 模型，快速分类（~100-200ms）
 * - 所有意图类型都走 patch 模式（除了 restructure）
 * - 分类失败时返回 fallback 信息
 */

import type { AppNode, NodeKind } from "@/types/flow";

// ============ Types ============
export type ModifyIntent =
    | "modify_attribute"  // 修改节点属性（记忆、温度等）→ patch
    | "add_node"          // 添加节点 → patch
    | "delete_node"       // 删除节点 → patch  
    | "restructure"       // 重构流程（复杂变更）→ full
    | "unknown";          // 无法识别 → full

export interface IntentResult {
    intent: ModifyIntent;
    confidence: number;           // 0-1
    targetNodeHint?: string;      // 用户提到的节点关键词
    targetNodeType?: NodeKind;    // 推断的目标节点类型
    shouldUsePatchMode: boolean;  // 是否使用 patch 模式
}

// ============ AI Classification ============

/**
 * 使用小模型分类用户意图
 * @param prompt 用户输入
 * @returns 意图分类结果
 */
export async function classifyIntent(prompt: string): Promise<IntentResult> {
    try {
        const response = await fetch("/api/classify-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            console.warn("[IntentClassifier] API failed, using fallback");
            return createFallbackResult();
        }

        const result = await response.json();

        // 验证返回格式
        if (!result.intent || typeof result.confidence !== "number") {
            return createFallbackResult();
        }

        // 决定是否使用 patch 模式
        // restructure 和 unknown 使用 full 模式，其他都用 patch
        const shouldUsePatchMode =
            result.intent !== "restructure" &&
            result.intent !== "unknown" &&
            result.confidence >= 0.7;

        return {
            intent: result.intent,
            confidence: result.confidence,
            targetNodeHint: result.targetNodeHint,
            targetNodeType: result.targetNodeType,
            shouldUsePatchMode,
        };
    } catch (e) {
        console.error("[IntentClassifier] Error:", e);
        return createFallbackResult();
    }
}

/**
 * 创建 fallback 结果（保守策略，使用 full 模式）
 */
function createFallbackResult(): IntentResult {
    return {
        intent: "unknown",
        confidence: 0,
        shouldUsePatchMode: false,
    };
}

// ============ Node Filtering ============

/**
 * 根据意图筛选相关节点（用于 patch 模式）
 * 只传入相关节点而非全部，减少 token 消耗
 */
export function filterRelevantNodes(
    nodes: AppNode[],
    intent: IntentResult
): AppNode[] {
    // 如果无法确定目标，返回全部（保守策略）
    if (!intent.targetNodeHint && !intent.targetNodeType) {
        return nodes;
    }

    const relevantNodes = nodes.filter(node => {
        // 按 label 匹配
        if (intent.targetNodeHint) {
            const label = (node.data as any).label || "";
            if (label.toLowerCase().includes(intent.targetNodeHint.toLowerCase())) {
                return true;
            }
        }

        // 按类型匹配
        if (intent.targetNodeType && node.type === intent.targetNodeType) {
            return true;
        }

        return false;
    });

    // 如果没找到匹配的，返回全部（保守策略）
    return relevantNodes.length > 0 ? relevantNodes : nodes;
}
