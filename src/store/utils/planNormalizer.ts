import { nanoid } from "nanoid";
import type { AppNode, AppEdge, AppNodeData, NodeKind, OutputInputMappings, OutputMode, ContentSource, AttachmentSource } from "@/types/flow";
import type { Plan, PlanNode, PlanEdge, PlanNodeData } from "@/types/plan";
import { LLM_EXECUTOR_CONFIG } from "@/store/constants/executorConfig";
import { DEFAULT_TOOL_TYPE } from "@/lib/tools/registry";
import { ensureBranchHandles } from "@/lib/branchHandleUtils";

// Helper to extract property from data or node root
function getProp<T>(node: PlanNode, data: PlanNodeData, key: keyof PlanNodeData): T | undefined {
    return (data?.[key] ?? (node as any)?.[key]) as T | undefined;
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function normalizeOutputMode(value: unknown): OutputMode | undefined {
    if (value === "direct" || value === "select" || value === "merge" || value === "template") return value;
    return undefined;
}

function normalizeContentSources(raw: unknown): ContentSource[] | undefined {
    if (!raw) return undefined;
    if (typeof raw === "string") {
        const v = raw.trim();
        return v ? [{ type: "variable", value: v }] : undefined;
    }
    if (Array.isArray(raw)) {
        const sources: ContentSource[] = [];
        for (const item of raw) {
            if (typeof item === "string") {
                const v = item.trim();
                if (v) sources.push({ type: "variable", value: v });
                continue;
            }
            if (!isNonNullObject(item)) continue;
            const type = item.type === "static" ? "static" : "variable";
            const value = typeof item.value === "string" ? item.value : "";
            const label = typeof item.label === "string" ? item.label : undefined;
            if (value.trim()) sources.push({ type, value, label });
        }
        return sources.length > 0 ? sources : undefined;
    }
    return undefined;
}

function normalizeAttachments(raw: unknown): AttachmentSource[] | undefined {
    if (!raw) return undefined;
    if (typeof raw === "string") {
        const v = raw.trim();
        return v ? [{ type: "variable", value: v }] : undefined;
    }
    if (Array.isArray(raw)) {
        const attachments: AttachmentSource[] = [];
        for (const item of raw) {
            if (typeof item === "string") {
                const v = item.trim();
                if (v) attachments.push({ type: "variable", value: v });
                continue;
            }
            if (!isNonNullObject(item)) continue;
            const type = item.type === "static" ? "static" : "variable";
            const value = typeof item.value === "string" ? item.value : "";
            if (value.trim()) attachments.push({ type, value });
        }
        return attachments.length > 0 ? attachments : undefined;
    }
    return undefined;
}

function normalizeOutputInputMappings(raw: unknown): OutputInputMappings | undefined {
    if (!isNonNullObject(raw)) return undefined;

    const mode = normalizeOutputMode(raw.mode);
    const sources = normalizeContentSources(raw.sources);
    const template = typeof raw.template === "string" ? raw.template : undefined;
    const attachments = normalizeAttachments(raw.attachments);

    const inferredMode: OutputMode | undefined =
        mode ||
        (typeof template === "string" && template.trim() ? "template" : sources ? "select" : undefined);

    if (!inferredMode) return undefined;

    const result: OutputInputMappings = { mode: inferredMode };
    if (sources) result.sources = sources;
    if (typeof template === "string" && template.trim()) result.template = template;
    if (attachments) result.attachments = attachments;
    return result;
}

function normalizeInputNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    const enableFileInput = getProp<boolean>(node, data, 'enableFileInput') ?? false;
    const enableStructuredForm = getProp<boolean>(node, data, 'enableStructuredForm') ?? false;
    const enableTextInput = getProp<boolean>(node, data, 'enableTextInput') ?? true;

    const toVariableSlug = (text: string) =>
        String(text || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "");

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
            maxSizeMB: fileConfig?.maxSizeMB ?? 10,
            maxCount: fileConfig?.maxCount ?? 5,
        };
    }

    // Handle form fields
    const rawFormFields = getProp<PlanNodeData['formFields']>(node, data, 'formFields') || [];
    const normalizedFormFields = (Array.isArray(rawFormFields) ? rawFormFields : [])
        .map((f: any, idx: number) => {
            const fieldType = String(f?.type || "text");
            const fieldLabel = String(f?.label || `字段${idx + 1}`);
            const baseName = String(f?.name || toVariableSlug(fieldLabel));
            const name = baseName ? baseName : `field_${nanoid(6)}`;
            const required = Boolean(f?.required);

            if (fieldType === "select") {
                const options = Array.isArray(f?.options) && f.options.length > 0 ? f.options.map(String) : ["选项1", "选项2"];
                const defaultValue = typeof f?.defaultValue === "string" ? f.defaultValue : options[0];
                return { type: "select", name, label: fieldLabel, options, required, defaultValue };
            }

            if (fieldType === "multi-select") {
                const options = Array.isArray(f?.options) && f.options.length > 0 ? f.options.map(String) : ["选项1", "选项2"];
                const defaultValue = Array.isArray(f?.defaultValue) ? f.defaultValue.map(String) : [];
                return { type: "multi-select", name, label: fieldLabel, options, required, defaultValue };
            }

            return {
                type: "text",
                name,
                label: fieldLabel,
                placeholder: typeof f?.placeholder === "string" ? f.placeholder : undefined,
                required,
                defaultValue: typeof f?.defaultValue === "string" ? f.defaultValue : undefined,
            };
        })
        .filter((f: any) => f && typeof f.name === "string" && f.name.length > 0);

    const formFields =
        enableStructuredForm && normalizedFormFields.length === 0
            ? [{ type: "text", name: `field_${nanoid(6)}`, label: "参数", required: false, defaultValue: "" }]
            : normalizedFormFields;

    return {
        label,
        status: "idle",
        text: String(getProp<string>(node, data, 'text') || ""),
        enableTextInput,
        textRequired: enableTextInput ? (getProp<boolean>(node, data, 'textRequired') === true) : false,
        enableFileInput,
        enableStructuredForm,
        fileRequired: enableFileInput ? (getProp<boolean>(node, data, 'fileRequired') === true) : false,
        fileConfig,
        formFields,
        greeting: String(getProp<string>(node, data, 'greeting') || ""),
    } as AppNodeData;
}

function normalizeLLMNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    const inputMappingsRaw = getProp<Record<string, string>>(node, data, 'inputMappings');
    const inputMappings =
        inputMappingsRaw && typeof inputMappingsRaw === "object" && !Array.isArray(inputMappingsRaw)
            ? inputMappingsRaw
            : undefined;

    return {
        label,
        status: "idle",
        model: String(getProp<string>(node, data, 'model') || LLM_EXECUTOR_CONFIG.DEFAULT_MODEL),
        temperature: typeof getProp<number>(node, data, 'temperature') === "number" ? getProp<number>(node, data, 'temperature') : LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
        systemPrompt: String(getProp<string>(node, data, 'systemPrompt') || ""),
        enableMemory: getProp<boolean>(node, data, 'enableMemory') ?? LLM_EXECUTOR_CONFIG.DEFAULT_MEMORY_ENABLED,
        memoryMaxTurns: getProp<number>(node, data, 'memoryMaxTurns') ?? LLM_EXECUTOR_CONFIG.DEFAULT_MEMORY_MAX_TURNS,
        responseFormat: (getProp<string>(node, data, 'responseFormat') as 'text' | 'json_object' | undefined) ?? LLM_EXECUTOR_CONFIG.DEFAULT_RESPONSE_FORMAT,
        inputMappings,
    } as AppNodeData;
}

function normalizeRAGNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    const filesRaw = getProp<PlanNodeData['files']>(node, data, 'files') || [];
    const processFiles = (raw: unknown) =>
        (Array.isArray(raw) ? raw : []).map((f: any) =>
        typeof f === "string"
            ? { name: f }
            : { name: String(f.name || "文件"), size: f.size, type: f.type, url: f.url }
    );
    const processedFiles = processFiles(filesRaw);
    const processedFiles2 = processFiles(getProp<any>(node, data, 'files2' as any) || []);
    const processedFiles3 = processFiles(getProp<any>(node, data, 'files3' as any) || []);
    const fileSearchStoreNameRaw = getProp<string>(node, data, 'fileSearchStoreName' as any);
    const fileSearchStoreIdRaw = getProp<string>(node, data, 'fileSearchStoreId' as any);
    return {
        label,
        status: "idle",
        files: processedFiles,
        files2: processedFiles2,
        files3: processedFiles3,
        fileMode: getProp<string>(node, data, 'fileMode') as 'variable' | 'static' | undefined,
        fileSearchStoreName: typeof fileSearchStoreNameRaw === "string" && fileSearchStoreNameRaw.trim() ? fileSearchStoreNameRaw : undefined,
        fileSearchStoreId: typeof fileSearchStoreIdRaw === "string" && fileSearchStoreIdRaw.trim() ? fileSearchStoreIdRaw : undefined,
        maxTokensPerChunk: getProp<number>(node, data, 'maxTokensPerChunk') ?? 200,
        maxOverlapTokens: getProp<number>(node, data, 'maxOverlapTokens') ?? 20,
        inputMappings: getProp<Record<string, string>>(node, data, 'inputMappings') || {},
    } as AppNodeData;
}

function normalizeToolNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    return {
        label,
        status: "idle",
        toolType: String(getProp<string>(node, data, 'toolType') || DEFAULT_TOOL_TYPE),
        inputs: getProp<Record<string, unknown>>(node, data, 'inputs') || {},
    } as AppNodeData;
}

function normalizeImageGenNode(node: PlanNode, data: PlanNodeData, label: string): AppNodeData {
    return {
        label,
        status: "idle",
        model: String(getProp<string>(node, data, 'model') || "Kwai-Kolors/Kolors"),
        prompt: String(getProp<string>(node, data, 'prompt') || ""),
        negativePrompt: String(getProp<string>(node, data, 'negativePrompt') || ""),
        imageSize: String(getProp<string>(node, data, 'imageSize') || "1024x1024"),
        cfg: getProp<number>(node, data, 'cfg') ?? 7.5,
        numInferenceSteps: getProp<number>(node, data, 'numInferenceSteps') ?? 25,
        referenceImageMode: (getProp<string>(node, data, 'referenceImageMode') as any) || "static",
        referenceImageVariable: String(getProp<string>(node, data, 'referenceImageVariable') || ""),
        referenceImage2Variable: String(getProp<string>(node, data, 'referenceImage2Variable') || ""),
        referenceImage3Variable: String(getProp<string>(node, data, 'referenceImage3Variable') || ""),
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
    const imagegens = nodes.filter((n) => n.type === "imagegen");
    const outs = nodes.filter((n) => n.type === "output");

    const chain: AppNode[] = [
        ...ins.length ? [ins[0]] : [],
        ...rags,
        ...https,
        ...tools,
        ...llms,
        ...imagegens,
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
                const rawCondition = String(getProp<string>(rn, d, 'condition') || "");
                data = {
                    label,
                    status: "idle",
                    condition: rawCondition.trim() ? rawCondition : "true",
                } as AppNodeData;
                break;
            case "tool":
                data = normalizeToolNode(rn, d, label);
                break;
            case "imagegen":
                data = normalizeImageGenNode(rn, d, label);
                break;
            case "output":
                const inputMappingsRaw = getProp<unknown>(rn, d, 'inputMappings');
                const inputMappings = normalizeOutputInputMappings(inputMappingsRaw) || {
                    mode: "select",
                    sources: [{ type: "variable", value: "{{response}}" }],
                };
                data = {
                    label,
                    status: "idle",
                    inputMappings,
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
                            maxSizeMB: 50,
                            maxCount: 10,
                        };
                    }
                }
            }
        }
    }

    const ensured = ensureBranchHandles(nodes, edges);
    return { nodes, edges: ensured.edges };
}
