import type { AppNode, FlowContext, BaseNodeData } from "@/types/flow";

/**
 * 递归展开对象，将嵌套字段平铺为可引用的变量
 * 例如：{ formatted: "2025-12-07", timestamp: 123 } 
 * => { "formatted": "2025-12-07", "timestamp": "123" }
 * 
 * 同时生成带节点标签前缀的变量名（如果节点有 label）
 * 例如：节点 label 为 "获取当前时间"
 * => { "获取当前时间.formatted": "2025-12-07" }
 */
export const flattenObject = (
    obj: unknown,
    targetMap: Record<string, string>,
    prefix = ""
): void => {
    if (obj === null || obj === undefined) return;

    if (typeof obj !== 'object') {
        // 基础类型直接作为值
        if (prefix) {
            targetMap[prefix] = String(obj);
        }
        return;
    }

    const record = obj as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
        // 跳过内部字段
        if (key.startsWith('_')) continue;

        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value === null || value === undefined) {
            targetMap[newKey] = "";
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            // 递归处理嵌套对象
            flattenObject(value, targetMap, newKey);
        } else if (Array.isArray(value)) {
            // 数组转为 JSON 字符串
            targetMap[newKey] = JSON.stringify(value);
        } else {
            targetMap[newKey] = String(value);
        }
    }
};

/**
 * 收集所有可用变量用于替换 Prompt
 * @param context 当前上下文
 * @param globalFlowContext 全局流程上下文
 * @param allNodes 所有节点
 * @param effectiveMockData 调试用的 Mock 数据
 */
export const collectVariables = (
    context: FlowContext,
    globalFlowContext: FlowContext,
    allNodes: AppNode[],
    effectiveMockData?: Record<string, unknown>
): Record<string, string> => {
    const allVariables: Record<string, string> = {};

    // 1. 调试模式：使用 mock 数据
    if (effectiveMockData && Object.keys(effectiveMockData).length > 0) {
        Object.entries(effectiveMockData).forEach(([key, value]) => {
            allVariables[key] = String(value);
        });
        return allVariables;
    }

    // 2. 先从全局 flowContext 中提取变量（较早执行的节点）
    // 这样后面直接上游的变量会覆盖这些，确保直接上游优先
    for (const [nodeId, nodeOutput] of Object.entries(globalFlowContext)) {
        if (nodeId.startsWith('_')) continue;
        // 跳过直接上游节点（后面会处理，以确保它们优先级更高）
        if (context[nodeId]) continue;

        const node = allNodes.find(n => n.id === nodeId);
        const nodeLabel = node?.data?.label as string | undefined;
        const customOutputs = (node?.data as BaseNodeData)?.customOutputs;

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            flattenObject(nodeOutput, allVariables);
            if (nodeLabel) {
                flattenObject(nodeOutput, allVariables, nodeLabel);
            }
            flattenObject(nodeOutput, allVariables, nodeId);
        }

        // 添加用户自定义的输出变量
        if (customOutputs && customOutputs.length > 0) {
            customOutputs.forEach(cv => {
                allVariables[cv.name] = cv.value;
                if (nodeLabel) {
                    allVariables[`${nodeLabel}.${cv.name}`] = cv.value;
                }
                allVariables[`${nodeId}.${cv.name}`] = cv.value;
            });
        }
    }

    // 3. 最后从直接上游 context 中提取变量（会覆盖全局中的同名变量）
    // 这确保了直接上游节点的输出优先级最高
    for (const [nodeId, nodeOutput] of Object.entries(context)) {
        if (nodeId.startsWith('_')) continue;

        // 查找对应节点以获取 label 和 customOutputs
        const node = allNodes.find(n => n.id === nodeId);
        const nodeLabel = node?.data?.label as string | undefined;
        const customOutputs = (node?.data as BaseNodeData)?.customOutputs;

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            // 展开节点输出的所有字段（无前缀，直接使用字段名）
            flattenObject(nodeOutput, allVariables);

            // 同时生成带节点 label 前缀的引用格式（如 {{获取当前时间.formatted}}）
            if (nodeLabel) {
                flattenObject(nodeOutput, allVariables, nodeLabel);
            }

            // 也支持用节点 ID 作为前缀（如 {{tool_xxx.formatted}}）
            flattenObject(nodeOutput, allVariables, nodeId);
        }

        // 添加用户自定义的输出变量
        if (customOutputs && customOutputs.length > 0) {
            customOutputs.forEach(cv => {
                allVariables[cv.name] = cv.value;
                if (nodeLabel) {
                    allVariables[`${nodeLabel}.${cv.name}`] = cv.value;
                }
                allVariables[`${nodeId}.${cv.name}`] = cv.value;
            });
        }
    }

    return allVariables;
};
