import { WorkflowZodSchema } from "@/lib/schemas/workflow";

// ============ JSON Extraction ============
// Bug #2 Fix: 使用平衡括号算法替代贪婪正则匹配
export function extractBalancedJson(text: string): string | null {
    const scoreWorkflowJson = (parsed: any): number => {
        if (!parsed || typeof parsed !== "object") return -1;
        const nodes = (Array.isArray(parsed.nodes) ? parsed.nodes : (Array.isArray(parsed.Nodes) ? parsed.Nodes : null)) as any[] | null;
        const edges = (Array.isArray(parsed.edges) ? parsed.edges : (Array.isArray(parsed.Edges) ? parsed.Edges : null)) as any[] | null;
        if (!nodes || !edges) return -1;

        const types = new Set(nodes.map((n) => String(n?.type || "")));

        let score = 0;
        score += nodes.length * 1000;
        score += edges.length * 10;

        if (types.has("llm")) score += 200;
        if (types.has("tool")) score += 150;
        if (types.has("rag")) score += 150;
        if (types.has("branch")) score += 150;
        if (types.has("imagegen")) score += 150;

        const hasOnlyIo =
            nodes.length === 2 &&
            types.has("input") &&
            types.has("output") &&
            !types.has("llm") &&
            !types.has("tool") &&
            !types.has("rag") &&
            !types.has("branch") &&
            !types.has("imagegen");
        if (hasOnlyIo) score -= 5000;
        if (nodes.length === 0) score -= 100000;

        return score;
    };

    // 1. 找到所有 '{' 的位置
    const braceIndices: number[] = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') braceIndices.push(i);
    }

    // 2. 对于每个 '{'，尝试找到平衡的 '}' 并验证内容
    // 策略：扫描全部候选，选择“最像工作流”的 JSON（防止最后出现空壳/示例 JSON 被误选）
    // 仍然倒序遍历以更快遇到最终输出，但不会立刻 return
    let bestJson: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let parsedCandidates = 0;
    for (let j = braceIndices.length - 1; j >= 0; j--) {
        const startIndex = braceIndices[j];
        
        // 快速剪枝：如果剩余长度小于最小 JSON 长度（{"nodes":[],"edges":[]} => ~20 chars），跳过
        if (text.length - startIndex < 20) continue;

        let depth = 0;
        let inString = false;
        let escape = false;
        
        for (let i = startIndex; i < text.length; i++) {
            const char = text[i];

            if (escape) {
                escape = false;
                continue;
            }

            if (char === '\\' && inString) {
                escape = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') depth++;
                else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        const jsonStr = text.slice(startIndex, i + 1);
                        
                        // 性能优化：先做简单的字符串检查，避免昂贵的 JSON.parse
                        // 必须包含工作流核心字段
                        const jsonLower = jsonStr.toLowerCase();
                        if (jsonLower.includes('"nodes"') && jsonLower.includes('"edges"')) {
                            try {
                                const parsed = JSON.parse(jsonStr);
                                parsedCandidates++;
                                const score = scoreWorkflowJson(parsed);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestJson = jsonStr;
                                }

                                if (bestScore >= 6000) {
                                    return bestJson;
                                }
                                if (parsedCandidates >= 20 && bestJson) {
                                    return bestJson;
                                }
                            } catch {
                            }
                        }
                        // 找到了平衡的括号但不是目标 JSON，继续找下一个 startIndex
                        break; 
                    }
                }
            }
        }
    }

    return bestJson;
}

// ============ Validation ============
import { deterministicFixWorkflowV1 } from "@/lib/agent/deterministicFixerV1";

// Updated Interface - 支持三层修复
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    softPass: boolean;
    fixedNodes?: any[];   // 修复后的节点
    fixedEdges?: any[];   // 修复后的边（结构自愈）
    warnings?: string[];  // 自动修复日志
    availableLabels?: string[]; // 当前工作流中所有合法的节点 Label
}

// ============ Validation ============
// 三层渐进式验证与自愈：Schema → 结构 → 变量
export function validateWorkflow(nodes: unknown[], edges: unknown[]): ValidationResult {
    const hasArrayNodes = Array.isArray(nodes);
    const hasArrayEdges = Array.isArray(edges);
    const safeNodes = hasArrayNodes ? (nodes as any[]) : [];
    const safeEdges = hasArrayEdges ? (edges as any[]) : [];

    if (!hasArrayNodes || safeNodes.length === 0) {
        return { valid: false, errors: ["No nodes generated"], softPass: true, fixedNodes: safeNodes, fixedEdges: safeEdges, warnings: [] };
    }

    const schemaErrors: string[] = [];
    try {
        WorkflowZodSchema.parse({ nodes: safeNodes, edges: safeEdges });
    } catch (error) {
        const zodError = error as { errors?: Array<{ message: string; path?: (string | number)[] }> };
        schemaErrors.push(...(zodError.errors?.map(e => `Schema Error: ${e.path?.join('.')}: ${e.message}`) || ["Unknown validation error"]));
    }

    const hasInput = safeNodes.some(n => n?.type === "input");
    const hasOutput = safeNodes.some(n => n?.type === "output");
    const integrityErrors: string[] = [];
    if (!hasInput) integrityErrors.push("工作流缺少 Input 节点");
    if (!hasOutput) integrityErrors.push("工作流缺少 Output 节点");

    const fixed = deterministicFixWorkflowV1(safeNodes, safeEdges, { includeInputOutput: false });
    const availableLabels = (Array.isArray(fixed.nodes) ? fixed.nodes : [])
        .map((n: any) => n?.data?.label)
        .filter((x: any) => typeof x === "string" && x.trim().length > 0);

    const errors = [...schemaErrors, ...integrityErrors];
    const ok = errors.length === 0;

    return {
        valid: ok,
        errors,
        softPass: true,
        fixedNodes: fixed.nodes,
        fixedEdges: fixed.edges,
        warnings: fixed.fixes,
        availableLabels
    };
}
