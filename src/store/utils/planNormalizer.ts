import { nanoid } from "nanoid";
import type { AppNode, AppEdge, AppNodeData, NodeKind } from "@/types/flow";
import type { Plan, PlanNode, PlanEdge, PlanNodeData } from "@/types/plan";

// Helper to extract property from data or node root
function getProp<T>(node: PlanNode, data: PlanNodeData, key: keyof PlanNodeData): T | undefined {
    return (data?.[key] ?? (node as any)?.[key]) as T | undefined;
}

function normalizeInputNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    const enableFileInput = getProp<boolean>(node, data, 'enableFileInput') ?? false;
    const enableStructuredForm = getProp<boolean>(node, data, 'enableStructuredForm') ?? false;

    // Handle file config
    let fileConfig = getProp<PlanNodeData['fileConfig']>(node, data, 'fileConfig');
    if (enableFileInput && (!fileConfig?.allowedTypes || fileConfig.allowedTypes.length === 0)) {
        const labelLower = label.toLowerCase();
        let defaultTypes: string[] = ['image/*', '.pdf', '.doc', '.docx', '.txt', '.md'];

        if (labelLower.includes('图片') || labelLower.includes('截图') || labelLower.includes('image')) {
            defaultTypes = ['image/*'];
        } else if (labelLower.includes('文档') || labelLower.includes('文件') || labelLower.includes('doc')) {
            defaultTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
        }

        fileConfig = {
            allowedTypes: defaultTypes,
            maxFileSize: fileConfig?.maxFileSize ?? 10,
            maxFileCount: fileConfig?.maxFileCount ?? 5,
        };
    }

    // Handle form fields
    let formFields = getProp<PlanNodeData['formFields']>(node, data, 'formFields') || [];
    if (enableStructuredForm && formFields.length === 0) {
        formFields = [{
            id: `field_${Date.now()}`,
            type: 'text',
            label: '参数',
            required: false,
        }];
    }

    return {
        label,
        status: "idle",
        text: String(getProp<string>(node, data, 'text') || ""),
        enableTextInput: getProp<boolean>(node, data, 'enableTextInput') ?? true,
        enableFileInput,
        enableStructuredForm,
        fileConfig,
        formFields,
        greeting: String(getProp<string>(node, data, 'greeting') || ""),
    } as AppNodeData;
}

function normalizeLLMNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    // 获取 inputMappings，如果没有则使用默认值
    const inputMappings = getProp<Record<string, string>>(node, data, 'inputMappings') || {
        user_input: '{{user_input}}'  // 默认引用上游的 user_input
    };

    return {
        label,
        status: "idle",
        model: String(getProp<string>(node, data, 'model') || "qwen-flash"),
        temperature: typeof getProp<number>(node, data, 'temperature') === "number" ? getProp<number>(node, data, 'temperature') : 0.7,
        systemPrompt: String(getProp<string>(node, data, 'systemPrompt') || ""),
        enableMemory: getProp<boolean>(node, data, 'enableMemory') ?? false,
        memoryMaxTurns: getProp<number>(node, data, 'memoryMaxTurns') ?? 10,
        inputMappings,
    } as AppNodeData;
}

function normalizeRAGNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    const filesRaw = getProp<PlanNodeData['files']>(node, data, 'files') || [];
    const processedFiles = (Array.isArray(filesRaw) ? filesRaw : []).map((f) =>
        typeof f === "string"
            ? { name: f }
            : { name: String(f.name || "文件"), size: f.size, type: f.type, url: f.url }
    );
    return {
        label,
        status: "idle",
        files: processedFiles,
        maxTokensPerChunk: getProp<number>(node, data, 'maxTokensPerChunk') ?? 200,
        maxOverlapTokens: getProp<number>(node, data, 'maxOverlapTokens') ?? 50,
        inputMappings: getProp<Record<string, string>>(node, data, 'inputMappings') || {},
    } as AppNodeData;
}

function normalizeToolNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    return {
        label,
        status: "idle",
        toolType: String(getProp<string>(node, data, 'toolType') || "web_search"),
        inputs: getProp<Record<string, unknown>>(node, data, 'inputs') || {},
    } as AppNodeData;
}

function createDefaultEdges(nodes: AppNode[]): AppEdge[] {
    const edges: AppEdge[] = [];
    const ins = nodes.filter((n) => n.type === "input");
    const rags = nodes.filter((n) => n.type === "rag");
    const https = nodes.filter((n) => n.type === "http" as any); // cast for dynamic type check
    const llms = nodes.filter((n) => n.type === "llm");
    const branches = nodes.filter((n) => n.type === "branch");
    const tools = nodes.filter((n) => n.type === "tool");
    const outs = nodes.filter((n) => n.type === "output");

    const chain: AppNode[] = [
        ...ins.length ? [ins[0]] : [],
        ...rags,
        ...https,
        ...tools,
        ...llms,
        ...branches,
        ...outs.length ? [outs[0]] : []
    ];

    for (let i = 0; i < chain.length - 1; i++) {
        edges.push({ id: `e-${chain[i].id}-${chain[i + 1].id}-${nanoid(4)}`, source: chain[i].id, target: chain[i + 1].id });
    }

    // Connect extra LLMs to output if main chain doesn't cover them all sequentially
    // The original logic seemed to connect all subsequent LLMs to the output, preserving that behavior:
    for (let i = 1; i < llms.length; i++) {
        if (outs[0]) edges.push({ id: `e-${llms[i].id}-${outs[0].id}-${nanoid(4)}`, source: llms[i].id, target: outs[0].id });
    }

    return edges;
}

/**
 * 规范化 LLM 返回的计划数据
 * 将 LLM 的 JSON 输出转换为标准的 AppNode 和 AppEdge 格式
 */
export function normalizePlan(plan: Plan, prompt: string): { nodes: AppNode[]; edges: AppEdge[] } {
    const rawNodes: PlanNode[] = Array.isArray(plan?.nodes) ? plan.nodes : [];
    const rawEdges: PlanEdge[] = Array.isArray(plan?.edges) ? plan.edges : [];

    const nodes: AppNode[] = rawNodes.map((rn: PlanNode, i: number) => {
        const type = String(rn?.type || "llm") as NodeKind;
        const id = String(rn?.id || `${type}-${nanoid(6)}`);
        const position = rn?.position || { x: 100 + i * 300, y: 200 };
        const d = rn?.data || {};
        const label = String(d?.label || rn?.label || type.toUpperCase());

        let data: AppNodeData = { label, status: "idle" };

        switch (type) {
            case "input":
                data = normalizeInputNode(rn, d, label);
                break;
            case "llm":
                data = normalizeLLMNode(rn, d, label);
                break;
            case "rag":
                data = normalizeRAGNode(rn, d, label);
                break;
            case "branch":
                data = {
                    label,
                    status: "idle",
                    condition: String(getProp<string>(rn, d, 'condition') || ""),
                } as AppNodeData;
                break;
            case "tool":
                data = normalizeToolNode(rn, d, label);
                break;
            case "output":
                data = {
                    label,
                    status: "idle",
                    text: String(getProp<string>(rn, d, 'text') || ""),
                    inputMappings: getProp<Record<string, string>>(rn, d, 'inputMappings') || {},
                } as AppNodeData;
                break;
            default:
                // Handle basic types like http if checked dynamically or fallback
                if ((type as string) === "http") {
                    data = {
                        label,
                        status: "idle",
                        method: String(getProp<string>(rn, d, 'method') || "GET"),
                        url: String(getProp<string>(rn, d, 'url') || ""),
                    } as any;
                }
                break;
        }

        return { id, type, position, data } as AppNode;
    });

    const idByLabel = new Map<string, string>();
    for (const n of nodes) idByLabel.set(String(n.data.label || "").toLowerCase(), n.id);

    const edges: AppEdge[] = [];
    for (const re of rawEdges) {
        const s = re?.source || re?.sourceId || re?.sourceLabel;
        const t = re?.target || re?.targetId || re?.targetLabel;
        let sid = typeof s === "string" ? s : "";
        let tid = typeof t === "string" ? t : "";

        if (!nodes.find((n) => n.id === sid)) sid = idByLabel.get(sid.toLowerCase()) || sid;
        if (!nodes.find((n) => n.id === tid)) tid = idByLabel.get(tid.toLowerCase()) || tid;

        if (nodes.find((n) => n.id === sid) && nodes.find((n) => n.id === tid)) {
            const edge: AppEdge = {
                id: `e-${sid}-${tid}-${nanoid(4)}`,
                source: sid,
                target: tid,
            };
            if (re?.sourceHandle) {
                edge.sourceHandle = re.sourceHandle;
            }
            edges.push(edge);
        }
    }

    if (edges.length === 0 && nodes.length) {
        edges.push(...createDefaultEdges(nodes));
    }

    // 问题3修复: 检测孤立节点（没有入边的非-input节点），自动连接到最近的上游节点
    const inputNode = nodes.find(n => n.type === 'input');
    if (inputNode && edges.length > 0) {
        const nodesWithIncoming = new Set(edges.map(e => e.target));
        const orphanNodes = nodes.filter(n => n.type !== 'input' && !nodesWithIncoming.has(n.id));
        
        for (const orphan of orphanNodes) {
            // 找到最合适的上游节点（优先级: input > llm > rag > tool > branch）
            const priorityOrder: NodeKind[] = ['input', 'rag', 'tool', 'llm', 'branch'];
            let bestSource = inputNode.id;
            
            for (const priority of priorityOrder) {
                const candidate = nodes.find(n => n.type === priority && n.id !== orphan.id);
                if (candidate) {
                    bestSource = candidate.id;
                    break;
                }
            }
            
            edges.push({
                id: `e-${bestSource}-${orphan.id}-${nanoid(4)}`,
                source: bestSource,
                target: orphan.id,
            });
        }
    }

    // 问题4修复: 根据 prompt 智能推断 input 节点的 enableFileInput
    const promptLower = prompt.toLowerCase();
    const fileKeywords = ['上传', '文档', '文件', '图片', '截图', 'pdf', '财报', '报告', '合同', '表格', 'excel', 'word', '照片', '图像', '附件'];
    const needsFileInput = fileKeywords.some(kw => promptLower.includes(kw));
    
    if (needsFileInput) {
        for (const node of nodes) {
            if (node.type === 'input') {
                const inputData = node.data as Record<string, unknown>;
                // 只有当 AI 没有显式设置时才补充
                if (inputData.enableFileInput !== true) {
                    inputData.enableFileInput = true;
                    // 确保有默认的 fileConfig
                    if (!inputData.fileConfig) {
                        inputData.fileConfig = {
                            allowedTypes: ['image/*', '.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx'],
                            maxFileSize: 50,
                            maxFileCount: 10,
                        };
                    }
                }
            }
        }
    }

    return { nodes, edges };
}

