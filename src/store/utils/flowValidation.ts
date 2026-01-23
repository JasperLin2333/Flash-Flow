import type { AppNode, AppEdge } from "@/types/flow";

/**
 * Flow Structure Validation Result
 */
export interface FlowValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate the structure of a generated workflow without actually executing it.
 * This is used by the Agent to verify the generated flow is runnable before saving.
 * 
 * Checks:
 * 1. Required nodes exist (at least one input and one output)
 * 2. All edges reference valid nodes
 * 3. No orphan nodes (except input nodes can be entry points)
 * 4. Node data is properly configured
 * 5. No circular dependencies that would cause infinite loops
 */
export function validateFlowStructure(
    nodes: AppNode[],
    edges: AppEdge[]
): FlowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    // 1. Check required nodes
    const inputNodes = nodes.filter(n => n.type === "input");
    const outputNodes = nodes.filter(n => n.type === "output");

    if (inputNodes.length === 0) {
        errors.push("工作流缺少 Input 节点");
    }
    if (outputNodes.length === 0) {
        errors.push("工作流缺少 Output 节点");
    }

    // 2. Validate edges reference valid nodes
    for (const edge of edges) {
        if (!nodeIds.has(edge.source)) {
            errors.push(`边的起点节点不存在: ${edge.source}`);
        }
        if (!nodeIds.has(edge.target)) {
            errors.push(`边的终点节点不存在: ${edge.target}`);
        }
    }

    // 3. Check for orphan nodes (nodes with no connections except input)
    for (const node of nodes) {
        if (node.type === "input") continue; // Input nodes are valid entry points

        const hasIncoming = edges.some(e => e.target === node.id);
        const hasOutgoing = edges.some(e => e.source === node.id);

        if (!hasIncoming && !hasOutgoing) {
            warnings.push(`节点 "${node.data?.label || node.id}" 是孤立的，没有任何连接`);
        } else if (!hasIncoming) {
            // Input nodes are already skipped above, so this is a non-input node without incoming edges
            warnings.push(`节点 "${node.data?.label || node.id}" 没有输入连接`);
        }
    }

    // 4. Validate node-specific data
    for (const node of nodes) {
        const label = node.data?.label || node.id;

        switch (node.type) {
            case "llm": {
                const data = node.data as Record<string, unknown>;
                if (!data.systemPrompt) {
                    errors.push(`LLM 节点 "${label}" 缺少 systemPrompt`);
                }
                if (!data.model) {
                    errors.push(`LLM 节点 "${label}" 缺少 model`);
                }
                break;
            }
            case "branch": {
                const data = node.data as Record<string, unknown>;
                if (!data.condition) {
                    errors.push(`Branch 节点 "${label}" 缺少 condition`);
                }
                break;
            }
            case "output": {
                const data = node.data as Record<string, unknown>;
                if (!data.inputMappings) {
                    warnings.push(`Output 节点 "${label}" 缺少 inputMappings`);
                }
                break;
            }
        }
    }

    // 5. Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
        if (recursionStack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;

        visited.add(nodeId);
        recursionStack.add(nodeId);

        const outgoingEdges = edges.filter(e => e.source === nodeId);
        for (const edge of outgoingEdges) {
            if (hasCycle(edge.target)) return true;
        }

        recursionStack.delete(nodeId);
        return false;
    };

    for (const node of nodes) {
        visited.clear();
        recursionStack.clear();
        if (hasCycle(node.id)) {
            errors.push("检测到循环依赖，工作流无法正常执行");
            break;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
