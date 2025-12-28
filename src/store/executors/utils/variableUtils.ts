import type { AppNode, FlowContext } from "@/types/flow";

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

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            flattenObject(nodeOutput, allVariables);
            if (nodeLabel) {
                flattenObject(nodeOutput, allVariables, nodeLabel);
            }
            flattenObject(nodeOutput, allVariables, nodeId);
        }
    }

    // 3. 最后从直接上游 context 中提取变量（会覆盖全局中的同名变量）
    // 这确保了直接上游节点的输出优先级最高
    for (const [nodeId, nodeOutput] of Object.entries(context)) {
        if (nodeId.startsWith('_')) continue;

        // 查找对应节点以获取 label 和 config
        const node = allNodes.find(n => n.id === nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            const outputObj = nodeOutput as Record<string, unknown>;

            // 展开节点输出的所有字段（无前缀，直接使用字段名）
            flattenObject(nodeOutput, allVariables);

            // 同时生成带节点 label 前缀的引用格式（如 {{获取当前时间.formatted}}）
            if (nodeLabel) {
                flattenObject(nodeOutput, allVariables, nodeLabel);
            }

            // 也支持用节点 ID 作为前缀（如 {{tool_xxx.formatted}}）
            flattenObject(nodeOutput, allVariables, nodeId);

            // 特殊处理：Input 节点的 formData，支持通过 label 引用
            // 例如：{{Input.formData.标签名}} -> 值
            if (node?.type === 'input') {
                const nodeData = node.data as Record<string, unknown>;
                const enableStructuredForm = nodeData?.enableStructuredForm as boolean | undefined;
                const formFields = nodeData?.formFields as Array<{ name: string; label: string }> | undefined;

                if (enableStructuredForm && formFields && formFields.length > 0 && outputObj.formData) {
                    const formData = outputObj.formData as Record<string, unknown>;

                    formFields.forEach(field => {
                        // 如果 formData 中有该字段的值
                        if (Object.prototype.hasOwnProperty.call(formData, field.name)) {
                            const value = formData[field.name];
                            const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

                            // 1. 支持 {{formData.标签名}} (直接引用)
                            allVariables[`formData.${field.label}`] = strValue;

                            // 2. 支持 {{节点名.formData.标签名}}
                            if (nodeLabel) {
                                allVariables[`${nodeLabel}.formData.${field.label}`] = strValue;
                            }

                            // 3. 支持 {{节点ID.formData.标签名}}
                            allVariables[`${nodeId}.formData.${field.label}`] = strValue;
                        }
                    });
                }
            }
        }
    }

    return allVariables;
};

/**
 * 收集所有可用变量（保留原始类型）
 * 用于需要保留原始类型的场景（如附件解析、文件引用）
 * 
 * 注意：同时生成扁平化的嵌套路径变量，支持如 {{节点名.formData.fieldName}}
 * 
 * @param context 当前直连上下文
 * @param globalFlowContext 全局流程上下文
 * @param allNodes 所有节点
 */
export const collectVariablesRaw = (
    context: FlowContext,
    globalFlowContext: FlowContext,
    allNodes: AppNode[]
): Record<string, unknown> => {
    const variables: Record<string, unknown> = {};

    // 使用 Map 优化节点查找性能
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));

    /**
     * 递归展开对象并添加到变量集合
     * @param obj 要展开的对象
     * @param prefix 键前缀
     */
    const flattenAndAdd = (obj: unknown, prefix: string): void => {
        if (obj === null || obj === undefined) {
            variables[prefix] = obj;
            return;
        }

        if (typeof obj !== 'object') {
            variables[prefix] = obj;
            return;
        }

        if (Array.isArray(obj)) {
            // 数组保留原始类型
            variables[prefix] = obj;
            return;
        }

        // 对象：保留整体引用，同时递归展开
        variables[prefix] = obj;
        const record = obj as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
            if (key.startsWith('_')) continue;
            flattenAndAdd(value, `${prefix}.${key}`);
        }
    };

    // 1. 先从全局 flowContext 中收集（较早执行的节点）
    for (const [nodeId, nodeOutput] of Object.entries(globalFlowContext)) {
        if (nodeId.startsWith('_')) continue;
        // 跳过直接上游节点（后面会处理，以确保它们优先级更高）
        if (context[nodeId]) continue;

        const node = nodeMap.get(nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            const record = nodeOutput as Record<string, unknown>;
            for (const [key, value] of Object.entries(record)) {
                if (key.startsWith('_')) continue;

                // 顶级字段
                variables[key] = value;
                // 递归展开嵌套对象
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenAndAdd(value, key);
                }

                // 带节点标签前缀
                if (nodeLabel) {
                    variables[`${nodeLabel}.${key}`] = value;
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        flattenAndAdd(value, `${nodeLabel}.${key}`);
                    }
                }

                // 带节点 ID 前缀
                variables[`${nodeId}.${key}`] = value;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenAndAdd(value, `${nodeId}.${key}`);
                }
            }
        }
    }

    // 2. 然后从直接上游 context 中收集（会覆盖全局中的同名变量）
    for (const [nodeId, nodeOutput] of Object.entries(context)) {
        if (nodeId.startsWith('_')) continue;

        const node = nodeMap.get(nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            const record = nodeOutput as Record<string, unknown>;
            for (const [key, value] of Object.entries(record)) {
                if (key.startsWith('_')) continue;

                // 顶级字段
                variables[key] = value;
                // 递归展开嵌套对象
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenAndAdd(value, key);
                }

                // 带节点标签前缀
                if (nodeLabel) {
                    variables[`${nodeLabel}.${key}`] = value;
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        flattenAndAdd(value, `${nodeLabel}.${key}`);
                    }
                }

                // 带节点 ID 前缀
                variables[`${nodeId}.${key}`] = value;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenAndAdd(value, `${nodeId}.${key}`);
                }
            }
        }
    }

    return variables;
};


/**
 * 构建全局节点查找 Map
 * 用于 Branch 条件表达式的节点数据查找
 * 
 * @param context 当前直连上下文
 * @param globalFlowContext 全局流程上下文
 * @param allNodes 所有节点（用于获取 label）
 */
export const buildGlobalNodeLookupMap = (
    context: FlowContext,
    globalFlowContext: FlowContext,
    allNodes: AppNode[]
): Map<string, unknown> => {
    const lookupMap = new Map<string, unknown>();

    // 使用 Map 优化节点查找性能
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));

    // 1. 先添加全局 flowContext 中的节点
    for (const [nodeId, nodeOutput] of Object.entries(globalFlowContext)) {
        if (nodeId.startsWith('_')) continue;
        if (typeof nodeOutput !== 'object' || nodeOutput === null) continue;

        const node = nodeMap.get(nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        // Add by nodeId (exact and lowercase)
        lookupMap.set(nodeId, nodeOutput);
        lookupMap.set(nodeId.toLowerCase(), nodeOutput);

        // Add by label if available
        if (nodeLabel) {
            lookupMap.set(nodeLabel, nodeOutput);
            lookupMap.set(nodeLabel.toLowerCase(), nodeOutput);
        }
    }

    // 2. 然后添加直接上游 context（会覆盖全局中的同名节点）
    for (const [nodeId, nodeOutput] of Object.entries(context)) {
        if (nodeId.startsWith('_')) continue;
        if (typeof nodeOutput !== 'object' || nodeOutput === null) continue;

        const node = nodeMap.get(nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        lookupMap.set(nodeId, nodeOutput);
        lookupMap.set(nodeId.toLowerCase(), nodeOutput);

        if (nodeLabel) {
            lookupMap.set(nodeLabel, nodeOutput);
            lookupMap.set(nodeLabel.toLowerCase(), nodeOutput);
        }
    }

    return lookupMap;
};
