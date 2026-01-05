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
 * 从嵌套对象中获取值，支持 field.subfield 和 array[index] 语法
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(/\.|\[/).map(p => p.replace(/\]$/, ''));
    let current: unknown = obj;

    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

/**
 * 解析变量模板，从预收集的全局变量中提取值
 * 用于 RAG 节点的动态文件解析等场景
 * 
 * @param template 变量模板，如 {{nodeLabel.files}}
 * @param context 当前上下文（保留用于向后兼容）
 * @param globalVariables 预收集的全局变量集合
 */
export function resolveVariableTemplate(
    template: string,
    context: FlowContext,
    globalVariables: Record<string, unknown>
): unknown {
    // 匹配 {{变量名}} 格式
    const match = template.match(/^\{\{(.+?)\}\}$/);
    if (!match) return template;

    const varPath = match[1].trim();

    // 直接从预收集的全局变量中查找
    if (varPath in globalVariables) {
        return globalVariables[varPath];
    }

    // 支持嵌套路径（如 nodeLabel.files[0].url）
    // 先尝试找到基础变量，再解析嵌套路径
    if (varPath.includes('.')) {
        const parts = varPath.split('.');
        // 尝试不同长度的前缀
        for (let i = parts.length - 1; i >= 1; i--) {
            const baseKey = parts.slice(0, i).join('.');
            if (baseKey in globalVariables) {
                const baseValue = globalVariables[baseKey];
                const remainingPath = parts.slice(i).join('.');
                return getNestedValue(baseValue as Record<string, unknown>, remainingPath);
            }
        }
    }

    return undefined;
}

// ============ 公共处理逻辑 ============

/**
 * 处理单个节点输出的回调接口
 */
interface NodeOutputProcessor<T> {
    /** 添加变量到集合 */
    addVariable: (key: string, value: unknown) => void;
    /** 递归展开嵌套对象 */
    flattenNested: (obj: unknown, prefix: string) => void;
    /** 最终返回的变量集合 */
    variables: T;
}

/**
 * 处理 Input 节点的 formData，支持通过 label 引用
 * 例如：{{输入.formData.标签名}} -> 值
 */
function processInputNodeFormData<T>(
    node: AppNode,
    nodeLabel: string | undefined,
    nodeId: string,
    formData: Record<string, unknown>,
    processor: NodeOutputProcessor<T>
): void {
    const nodeData = node.data as Record<string, unknown>;
    const enableStructuredForm = nodeData?.enableStructuredForm as boolean | undefined;
    const formFields = nodeData?.formFields as Array<{ name: string; label: string }> | undefined;

    if (!enableStructuredForm || !formFields || formFields.length === 0) return;

    formFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(formData, field.name)) {
            const value = formData[field.name];
            // 1. {{formData.标签名}}
            processor.addVariable(`formData.${field.label}`, value);
            // 2. {{节点名.formData.标签名}}
            if (nodeLabel) {
                processor.addVariable(`${nodeLabel}.formData.${field.label}`, value);
            }
            // 3. {{节点ID.formData.标签名}}
            processor.addVariable(`${nodeId}.formData.${field.label}`, value);
        }
    });
}

/**
 * 遍历节点输出并处理变量收集的核心逻辑
 * @param flowContextEntries 要遍历的 flowContext 条目
 * @param nodeMap 节点 ID 到节点的映射
 * @param processor 处理器回调
 * @param skipNodeIds 要跳过的节点 ID 集合（用于优先级控制）
 */
function processFlowContextEntries<T>(
    flowContextEntries: [string, Record<string, unknown> | undefined][],
    nodeMap: Map<string, AppNode>,
    processor: NodeOutputProcessor<T>,
    skipNodeIds?: Set<string>
): void {
    for (const [nodeId, nodeOutput] of flowContextEntries) {
        if (nodeId.startsWith('_')) continue;
        if (skipNodeIds?.has(nodeId)) continue;

        const node = nodeMap.get(nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            const record = nodeOutput as Record<string, unknown>;

            for (const [key, value] of Object.entries(record)) {
                if (key.startsWith('_')) continue;
                // 过滤掉 reasoning 字段
                if (key === 'reasoning') continue;

                // 顶级字段
                processor.addVariable(key, value);
                // 递归展开嵌套对象
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    processor.flattenNested(value, key);
                }

                // 带节点标签前缀
                if (nodeLabel) {
                    processor.addVariable(`${nodeLabel}.${key}`, value);
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        processor.flattenNested(value, `${nodeLabel}.${key}`);
                    }
                }

                // 带节点 ID 前缀
                processor.addVariable(`${nodeId}.${key}`, value);
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    processor.flattenNested(value, `${nodeId}.${key}`);
                }
            }

            // 特殊处理：Input 节点的 formData
            if (node?.type === 'input' && record.formData) {
                processInputNodeFormData(
                    node,
                    nodeLabel,
                    nodeId,
                    record.formData as Record<string, unknown>,
                    processor
                );
            }
        }
    }
}

// ============ 公开 API ============

/**
 * 收集所有可用变量用于替换 Prompt（字符串版本）
 * @param context 当前上下文
 * @param globalFlowContext 全局流程上下文
 * @param allNodes 所有节点
 * @param effectiveMockData 调试用的 Mock 数据
 */
export const collectVariables = (
    context: FlowContext,
    globalFlowContext: FlowContext,
    allNodes: AppNode[],
    effectiveMockData?: Record<string, unknown>,
    nodeMap?: Map<string, AppNode>
): Record<string, string> => {
    const variables: Record<string, string> = {};

    // 1. 调试模式：使用 mock 数据
    if (effectiveMockData && Object.keys(effectiveMockData).length > 0) {
        Object.entries(effectiveMockData).forEach(([key, value]) => {
            variables[key] = String(value);
        });
        return variables;
    }

    // 使用传入的 nodeMap 或创建新的
    const effectiveNodeMap = nodeMap ?? new Map(allNodes.map(n => [n.id, n]));

    // 创建字符串版本的处理器
    const processor: NodeOutputProcessor<Record<string, string>> = {
        variables,
        addVariable: (key, value) => {
            if (typeof value === 'object' && value !== null) {
                variables[key] = JSON.stringify(value);
            } else {
                variables[key] = value == null ? '' : String(value);
            }
        },
        flattenNested: (obj, prefix) => {
            flattenObject(obj, variables, prefix);
        }
    };

    // 要跳过的节点（直接上游的，后面会单独处理以确保优先级）
    const directUpstreamIds = new Set(Object.keys(context).filter(k => !k.startsWith('_')));

    // 2. 先从全局 flowContext 中提取变量（较早执行的节点）
    processFlowContextEntries(
        Object.entries(globalFlowContext) as [string, Record<string, unknown> | undefined][],
        effectiveNodeMap,
        processor,
        directUpstreamIds
    );

    // 3. 从直接上游 context 中提取变量（会覆盖全局中的同名变量）
    processFlowContextEntries(
        Object.entries(context) as [string, Record<string, unknown> | undefined][],
        effectiveNodeMap,
        processor
    );

    return variables;
};

/**
 * 收集所有可用变量（保留原始类型）
 * 用于需要保留原始类型的场景（如附件解析、文件引用）
 * 
 * @param context 当前直连上下文
 * @param globalFlowContext 全局流程上下文
 * @param allNodes 所有节点
 */
export const collectVariablesRaw = (
    context: FlowContext,
    globalFlowContext: FlowContext,
    allNodes: AppNode[],
    nodeMap?: Map<string, AppNode>
): Record<string, unknown> => {
    const variables: Record<string, unknown> = {};
    // 使用传入的 nodeMap 或创建新的
    const effectiveNodeMap = nodeMap ?? new Map(allNodes.map(n => [n.id, n]));

    /**
     * 递归展开对象并添加到变量集合（保留原始类型）
     */
    const flattenAndAddRaw = (obj: unknown, prefix: string): void => {
        if (obj === null || obj === undefined) {
            variables[prefix] = obj;
            return;
        }

        if (typeof obj !== 'object') {
            variables[prefix] = obj;
            return;
        }

        if (Array.isArray(obj)) {
            variables[prefix] = obj;
            return;
        }

        // 对象：保留整体引用，同时递归展开
        variables[prefix] = obj;
        const record = obj as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
            if (key.startsWith('_')) continue;
            flattenAndAddRaw(value, `${prefix}.${key}`);
        }
    };

    // 创建原始类型版本的处理器
    const processor: NodeOutputProcessor<Record<string, unknown>> = {
        variables,
        addVariable: (key, value) => {
            variables[key] = value;
        },
        flattenNested: flattenAndAddRaw
    };

    // 要跳过的节点（直接上游的，后面会单独处理以确保优先级）
    const directUpstreamIds = new Set(Object.keys(context).filter(k => !k.startsWith('_')));

    // 1. 先从全局 flowContext 中收集（较早执行的节点）
    processFlowContextEntries(
        Object.entries(globalFlowContext) as [string, Record<string, unknown> | undefined][],
        effectiveNodeMap,
        processor,
        directUpstreamIds
    );

    // 2. 从直接上游 context 中收集（会覆盖全局中的同名变量）
    processFlowContextEntries(
        Object.entries(context) as [string, Record<string, unknown> | undefined][],
        effectiveNodeMap,
        processor
    );

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
