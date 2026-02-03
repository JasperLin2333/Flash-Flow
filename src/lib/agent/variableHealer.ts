import { extractVariables } from "@/lib/promptParser";

/**
 * 变量自愈结果接口
 */
export interface HealerResult {
    fixedNodes: any[];   // 修复后的节点列表 (使用 any 兼容 AppNode 和生成时的纯 JSON 对象)
    fixes: string[];     // 修复日志 (如 "Auto-fixed ID 'input_1' to Label '用户输入'")
    errors: string[];    // 剩余无法修复的错误 (包含智能建议)
    availableLabels: string[]; // 当前工作流中所有合法的节点 Label
}

/**
 * Levenshtein 距离算法 (用于模糊匹配)
 */
function levenshteinDistance(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,       // deletion
                matrix[i][j - 1] + 1,       // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[a.length][b.length];
}

/**
 * 核心自愈函数
 */
export function healVariables(nodes: any[]): HealerResult {
    const fixes: string[] = [];
    const errors: string[] = [];

    // 1. 建立查找表
    const idToLabelMap = new Map<string, string>();
    const labelSet = new Set<string>();
    const typeCounter = new Map<string, number>();      // 用于统计某种类型的节点数量
    const typeToLabelMap = new Map<string, string>();   // 用于单例类型的 Label 映射

    nodes.forEach(node => {
        const id = node.id;
        const label = node.data?.label;
        const type = node.type;

        if (id && label) {
            idToLabelMap.set(id, label);
            idToLabelMap.set(id.toLowerCase(), label); // 支持不区分大小写的 ID 查找
            labelSet.add(label);
        }

        if (type) {
            const count = (typeCounter.get(type) || 0) + 1;
            typeCounter.set(type, count);
            if (label) {
                typeToLabelMap.set(type, label); // 暂时存储，只有 count === 1 时才有效
            }
        }
    });

    // 用于模糊匹配的候选列表
    const allLabels = Array.from(labelSet);

    // 2. 深度遍历并修复 (Deep Clone to avoid mutation side-effects during iteration)
    // 简单的 JSON clone 足够应对 plain object 结构
    const clonedNodes = JSON.parse(JSON.stringify(nodes));

    const traverseAndHeal = (obj: any, nodeId: string) => {
        if (!obj || typeof obj !== 'object') return;

        for (const key in obj) {
            const value = obj[key];

            // 字符串字段可能是 Prompt 或其他含变量的文本
            if (typeof value === 'string') {
                const vars = extractVariables(value);

                for (const varName of vars) {
                    // 解析前缀 (e.g., "用户输入" form "用户输入.text")
                    const parts = varName.split('.');
                    const prefix = parts[0];

                    // A. 如果 Prefix 已经是有效的 Label，跳过
                    if (labelSet.has(prefix)) continue;

                    // B. 仅生成确定性建议（report-only，不直接改写）

                    // B1. ID 还原建议: {{input_1.text}} -> {{用户输入.text}}
                    if (idToLabelMap.has(prefix)) {
                        const correctLabel = idToLabelMap.get(prefix)!;
                        const newVarName = [correctLabel, ...parts.slice(1)].join('.');
                        fixes.push(`Node '${nodeId}': Suggest replacing '{{${varName}}}' with '{{${newVarName}}}'`);
                        continue;
                    }

                    // B2. 单例类型推导建议: {{Input.text}} -> {{用户输入.text}} (前提: 只有一个 Input 节点)
                    // 将 prefix 视为 Type (忽略大小写, e.g. "input" == "Input")
                    // 常见误用的类型名映射
                    const typeAliasMap: Record<string, string> = {
                        'Input': 'input',
                        'Start': 'input',
                        'LLM': 'llm',
                        'RAG': 'rag',
                        'Tool': 'tool',
                        'Search': 'tool', // 常见误报
                        'Branch': 'branch',
                        'ImageGen': 'imagegen',
                        'Output': 'output',
                        'End': 'output'
                    };

                    const normalizedType = typeAliasMap[prefix] || prefix.toLowerCase();

                    // 检查是否为单例
                    if (typeCounter.get(normalizedType) === 1) {
                        const correctLabel = typeToLabelMap.get(normalizedType);
                        if (correctLabel) {
                            const newVarName = [correctLabel, ...parts.slice(1)].join('.');
                            fixes.push(`Node '${nodeId}': Suggest replacing '{{${varName}}}' with '{{${newVarName}}}'`);
                            continue;
                        }
                    }

                    // B3. 大小写/空格修正建议: {{User Input.text}} vs {{UserInput.text}}
                    // 尝试在 labelSet 中找不区分空格和大小写的匹配
                    const cleanPrefix = prefix.replace(/\s+/g, '').toLowerCase();
                    const matchedLabel = allLabels.find(l => l.replace(/\s+/g, '').toLowerCase() === cleanPrefix);
                    if (matchedLabel) {
                        const newVarName = [matchedLabel, ...parts.slice(1)].join('.');
                        fixes.push(`Node '${nodeId}': Suggest replacing '{{${varName}}}' with '{{${newVarName}}}'`);
                        continue;
                    }

                    // C. 智能建议 (Smart Suggestions)

                    // 模糊匹配建议 (是否拼写错误?)
                    const bestMatch = allLabels.reduce((best, current) => {
                        const dist = levenshteinDistance(prefix, current);
                        if (dist < best.dist) return { label: current, dist };
                        return best;
                    }, { label: '', dist: Infinity });

                    let suggestion = "";
                    // 如果相似度够高 (距离 <= 2 或 <= 长度的30%)
                    if (bestMatch.dist <= 2 || bestMatch.dist <= prefix.length * 0.3) {
                        suggestion = ` Did you mean '{{${bestMatch.label}.${parts.slice(1).join('.')}}}'?`;
                    }
                    // 如果是类型歧义 (Input 但有多个 Input 节点)
                    else if (typeCounter.has(normalizedType) && (typeCounter.get(normalizedType) || 0) > 1) {
                        suggestion = ` 'Input' is ambiguous because there are ${typeCounter.get(normalizedType)} input nodes. Please use the specific node label.`;
                    }

                    errors.push(`Node '${nodeId}' references undefined variable '{{${varName}}}'. Label '${prefix}' found.${suggestion}`);
                }
            }
            // 递归处理数组和对象
            else if (typeof value === 'object') {
                traverseAndHeal(value, nodeId);
            }
        }
    };

    clonedNodes.forEach((node: any) => {
        traverseAndHeal(node.data, node.id || 'unknown');
    });

    return {
        fixedNodes: clonedNodes,
        fixes,
        errors,
        availableLabels: allLabels
    };
}
