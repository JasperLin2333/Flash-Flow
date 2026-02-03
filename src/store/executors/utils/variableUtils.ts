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
/**
 * 检查对象是否符合 File 结构接口
 */
function isFileObject(obj: unknown): obj is { url: string; name?: string; type?: string } {
    if (typeof obj !== 'object' || obj === null) return false;
    const item = obj as Record<string, unknown>;
    return typeof item.url === 'string' && (typeof item.name === 'string' || typeof item.type === 'string');
}

/**
 * 检查是否为纯文件数组
 */
function isFileArray(obj: unknown): boolean {
    return Array.isArray(obj) && obj.length > 0 && obj.every(isFileObject);
}

/**
 * 获取任意对象的"语义化字符串值" (Semantic String Value)
 * 
 * 第一性原理：在文本替换(Prompt)场景下，该对象最应该被呈现为什么？
 * 1. File -> URL
 * 2. File[] -> URL List
 * 3. Array -> JSON
 * 4. Object -> JSON
 */
export function getSemanticStringValue(obj: unknown): string {
    if (obj === null || obj === undefined) return "";

    // 1. 数组处理
    if (Array.isArray(obj)) {
        // 启发式：如果看起来像文件列表，返回逗号分隔的 URL
        if (isFileArray(obj)) {
            return obj.map(item => (item as { url: string }).url).join(', ');
        }
        return JSON.stringify(obj);
    }

    // 2. 对象处理
    if (typeof obj === 'object') {
        // 启发式：如果是文件对象，返回 URL
        if (isFileObject(obj)) {
            return obj.url;
        }
        return JSON.stringify(obj);
    }

    // 3. 基本类型
    return String(obj);
}

/**
 * 递归展开对象，将嵌套字段平铺为可引用的变量
 * 
 * 核心升级：多态解析 (Polymorphic Resolution)
 * 1. 结构访问：递归所有层级 (files[0].name)
 * 2. 值访问：为中间节点赋予语义化字符串值 (files[0] -> URL)
 */
export const flattenObject = (
    obj: unknown,
    targetMap: Record<string, string>,
    prefix = ""
): void => {
    // 1. 值访问 (Value Access)：计算当前节点的语义值
    // 这解决了 {{files[0]}} 在 Prompt 中直接输出 URL 的需求
    if (prefix) {
        targetMap[prefix] = getSemanticStringValue(obj);
    }

    // 2. 结构访问 (Structural Access)：递归展开
    if (Array.isArray(obj)) {
        // 即使是数组，也继续递归展开其元素
        // 这解决了 {{files[0].name}} 的引用需求
        obj.forEach((item, index) => {
            flattenObject(item, targetMap, `${prefix}[${index}]`);
        });
    } else if (typeof obj === 'object' && obj !== null) {
        const record = obj as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
            // 跳过内部字段
            if (key.startsWith('_')) continue;

            const newKey = prefix ? `${prefix}.${key}` : key;
            flattenObject(value, targetMap, newKey);
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
        (processor as any)._originNodeId = nodeId;
        (processor as any)._originNodeLabel = nodeLabel;

        if (typeof nodeOutput === 'object' && nodeOutput !== null) {
            const record = nodeOutput as Record<string, unknown>;

            for (const [key, value] of Object.entries(record)) {
                if (key.startsWith('_')) continue;
                if (key === 'reasoning') {
                    if (nodeLabel) {
                        processor.addVariable(`${nodeLabel}.${key}`, value);
                    }
                    processor.addVariable(`${nodeId}.${key}`, value);
                    continue;
                }

                // 顶级字段
                processor.addVariable(key, value);
                // 递归展开嵌套对象
                if (typeof value === 'object' && value !== null) {
                    processor.flattenNested(value, key);
                }

                // 带节点标签前缀
                if (nodeLabel) {
                    processor.addVariable(`${nodeLabel}.${key}`, value);
                    if (typeof value === 'object' && value !== null) {
                        processor.flattenNested(value, `${nodeLabel}.${key}`);
                    }
                }

                // 带节点 ID 前缀
                processor.addVariable(`${nodeId}.${key}`, value);
                if (typeof value === 'object' && value !== null) {
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

    const aliasOwners = new Map<string, string>();
    const ambiguousAliases = new Set<string>();

    const processor: NodeOutputProcessor<Record<string, string>> = {
        variables,
        addVariable: (key, value) => {
            const originNodeId = (processor as any)._originNodeId as string | undefined;
            const originNodeLabel = (processor as any)._originNodeLabel as string | undefined;
            const semanticValue = getSemanticStringValue(value);

            const isNamespaced =
                (originNodeId && key.startsWith(`${originNodeId}.`)) ||
                (originNodeLabel && key.startsWith(`${originNodeLabel}.`));

            if (isNamespaced || !originNodeId) {
                variables[key] = semanticValue;
                return;
            }

            if (ambiguousAliases.has(key)) return;

            const owner = aliasOwners.get(key);
            if (!owner) {
                aliasOwners.set(key, originNodeId);
                variables[key] = semanticValue;
                delete variables[`__ambiguous.${key}`];
                return;
            }

            if (owner !== originNodeId) {
                ambiguousAliases.add(key);
                aliasOwners.delete(key);
                delete variables[key];
                variables[`__ambiguous.${key}`] = "true";
                return;
            }

            variables[key] = semanticValue;
            delete variables[`__ambiguous.${key}`];
        },
        flattenNested: (obj, prefix) => {
            const walk = (current: unknown, currentPrefix: string) => {
                processor.addVariable(currentPrefix, current);
                if (Array.isArray(current)) {
                    current.forEach((item, idx) => walk(item, `${currentPrefix}[${idx}]`));
                    return;
                }
                if (typeof current === "object" && current !== null) {
                    const record = current as Record<string, unknown>;
                    for (const [k, v] of Object.entries(record)) {
                        if (k.startsWith('_')) continue;
                        walk(v, `${currentPrefix}.${k}`);
                    }
                }
            };
            walk(obj, prefix);
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

    aliasOwners.clear();
    ambiguousAliases.clear();

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

    const aliasOwners = new Map<string, string>();
    const ambiguousAliases = new Set<string>();

    const processor: NodeOutputProcessor<Record<string, unknown>> = {
        variables,
        addVariable: (key, value) => {
            const originNodeId = (processor as any)._originNodeId as string | undefined;
            const originNodeLabel = (processor as any)._originNodeLabel as string | undefined;
            const isNamespaced =
                (originNodeId && key.startsWith(`${originNodeId}.`)) ||
                (originNodeLabel && key.startsWith(`${originNodeLabel}.`));

            if (isNamespaced || !originNodeId) {
                variables[key] = value;
                return;
            }

            if (ambiguousAliases.has(key)) return;

            const owner = aliasOwners.get(key);
            if (!owner) {
                aliasOwners.set(key, originNodeId);
                variables[key] = value;
                delete (variables as any)[`__ambiguous.${key}`];
                return;
            }

            if (owner !== originNodeId) {
                ambiguousAliases.add(key);
                aliasOwners.delete(key);
                delete variables[key];
                (variables as any)[`__ambiguous.${key}`] = true;
                return;
            }

            variables[key] = value;
            delete (variables as any)[`__ambiguous.${key}`];
        },
        flattenNested: (obj, prefix) => {
            const walk = (current: unknown, currentPrefix: string) => {
                processor.addVariable(currentPrefix, current);
                if (Array.isArray(current)) {
                    current.forEach((item, idx) => walk(item, `${currentPrefix}[${idx}]`));
                    return;
                }
                if (typeof current === "object" && current !== null) {
                    const record = current as Record<string, unknown>;
                    for (const [k, v] of Object.entries(record)) {
                        if (k.startsWith('_')) continue;
                        walk(v, `${currentPrefix}.${k}`);
                    }
                }
            };
            walk(obj, prefix);
        }
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

    aliasOwners.clear();
    ambiguousAliases.clear();

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
    allNodes: AppNode[],
    allowedNodeIds?: Set<string>
): Map<string, unknown> => {
    const lookupMap = new Map<string, unknown>();

    // 使用 Map 优化节点查找性能
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));

    const enrichOutput = (nodeId: string, output: unknown): unknown => {
        if (!output || typeof output !== 'object') return output;

        const node = nodeMap.get(nodeId);
        if (!node) return output;

        if (node.type === 'input') {
            const record = output as Record<string, unknown>;
            const next: Record<string, unknown> = { ...record };

            if (typeof next.user_input === "string" && (typeof next.text !== "string" || !next.text.trim())) {
                next.text = next.user_input;
            }

            const nodeData = node.data as Record<string, unknown>;
            const formFields = nodeData?.formFields as Array<{ name: string; label: string }> | undefined;
            const enableStructuredForm = nodeData?.enableStructuredForm as boolean;

            if (enableStructuredForm && formFields && formFields.length > 0) {
                if (next.formData && typeof next.formData === 'object') {
                    const enrichedFormData = { ...(next.formData as Record<string, unknown>) };
                    formFields.forEach(field => {
                        if (field.name in enrichedFormData) {
                            enrichedFormData[field.label] = enrichedFormData[field.name];
                        }
                    });
                    next.formData = enrichedFormData;
                }
            }

            return next;
        }

        if (node.type === 'llm') {
            const record = output as Record<string, unknown>;
            const next: Record<string, unknown> = { ...record };
            if (typeof next.response === "string" && (typeof next.answer !== "string" || !next.answer.trim())) {
                next.answer = next.response;
            }
            return next;
        }

        return output;
    };

    // 1. 先添加全局 flowContext 中的节点
    for (const [nodeId, nodeOutput] of Object.entries(globalFlowContext)) {
        if (nodeId.startsWith('_')) continue;
        if (allowedNodeIds && !allowedNodeIds.has(nodeId)) continue;
        if (typeof nodeOutput !== 'object' || nodeOutput === null) continue;

        const node = nodeMap.get(nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        // 注入别名
        const enrichedOutput = enrichOutput(nodeId, nodeOutput);

        // Add by nodeId (exact and lowercase)
        lookupMap.set(nodeId, enrichedOutput);
        lookupMap.set(nodeId.toLowerCase(), enrichedOutput);

        // Add by label if available
        if (nodeLabel) {
            lookupMap.set(nodeLabel, enrichedOutput);
            lookupMap.set(nodeLabel.toLowerCase(), enrichedOutput);
        }
    }

    // 2. 然后添加直接上游 context（会覆盖全局中的同名节点）
    for (const [nodeId, nodeOutput] of Object.entries(context)) {
        if (nodeId.startsWith('_')) continue;
        if (allowedNodeIds && !allowedNodeIds.has(nodeId)) continue;
        if (typeof nodeOutput !== 'object' || nodeOutput === null) continue;

        const node = nodeMap.get(nodeId);
        const nodeLabel = node?.data?.label as string | undefined;

        // 注入别名
        const enrichedOutput = enrichOutput(nodeId, nodeOutput);

        lookupMap.set(nodeId, enrichedOutput);
        lookupMap.set(nodeId.toLowerCase(), enrichedOutput);

        if (nodeLabel) {
            lookupMap.set(nodeLabel, enrichedOutput);
            lookupMap.set(nodeLabel.toLowerCase(), enrichedOutput);
        }
    }

    return lookupMap;
};
