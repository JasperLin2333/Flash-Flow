import { nanoid } from "nanoid";
import type { AppNode, AppEdge, AppNodeData, NodeKind } from "@/types/flow";

// LLM 返回的计划数据类型
export type PlanNodeData = Partial<AppNodeData> & {
    label?: string;
    text?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    files?: Array<string | { name: string; size?: number; type?: string; url?: string }>;
    method?: string;
    url?: string;
    // Input node configs
    enableTextInput?: boolean;
    enableFileInput?: boolean;
    enableStructuredForm?: boolean;
    fileConfig?: {
        allowedTypes?: string[];
        maxFileSize?: number;
        maxFileCount?: number;
    };
    formFields?: Array<{ id: string; type: string; label: string; required?: boolean; defaultValue?: string; options?: string[] }>;
    // LLM node configs
    enableMemory?: boolean;
    memoryMaxTurns?: number;
    // Branch node configs
    condition?: string;
    // Tool node configs
    toolType?: string;
    inputs?: Record<string, unknown>;
    // RAG node configs
    topK?: number;
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
};

export type PlanNode = {
    id?: string;
    type?: NodeKind | string;
    position?: { x: number; y: number };
    data?: PlanNodeData;
    label?: string;
    // 支持直接属性（如果 AI 返回的结构没有用 data 包裹）
    text?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    files?: Array<string | { name: string; size?: number; type?: string; url?: string }>;
    method?: string;
    url?: string;
    // Direct properties for input node
    enableTextInput?: boolean;
    enableFileInput?: boolean;
    enableStructuredForm?: boolean;
    fileConfig?: PlanNodeData['fileConfig'];
    formFields?: PlanNodeData['formFields'];
    // Direct properties for LLM node
    enableMemory?: boolean;
    memoryMaxTurns?: number;
    // Direct properties for Branch node
    condition?: string;
    // Direct properties for Tool node
    toolType?: string;
    inputs?: Record<string, unknown>;
    // Direct properties for RAG node
    topK?: number;
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
};

export type PlanEdge = {
    id?: string;
    source?: string;
    target?: string;
    sourceId?: string;
    targetId?: string;
    sourceLabel?: string;
    targetLabel?: string;
    label?: string;
    sourceHandle?: string; // For branch nodes: "true" or "false"
};

export type Plan = {
    title?: string;
    nodes?: PlanNode[];
    edges?: PlanEdge[]
};

/**
 * 规范化 LLM 返回的计划数据
 * 将 LLM 的 JSON 输出转换为标准的 AppNode 和 AppEdge 格式
 * 
 * CRITICAL: 保留所有节点配置，包括：
 * - Input: enableFileInput, enableTextInput, fileConfig 等
 * - LLM: enableMemory, memoryMaxTurns 等
 * - Branch: condition
 * - Tool: toolType, inputs
 * - RAG: topK, maxTokensPerChunk 等
 */
export function normalizePlan(plan: Plan, prompt: string): { nodes: AppNode[]; edges: AppEdge[] } {
    const rawNodes: PlanNode[] = Array.isArray(plan?.nodes) ? plan.nodes : [];
    const rawEdges: PlanEdge[] = Array.isArray(plan?.edges) ? plan.edges : [];

    const nodes: AppNode[] = rawNodes.map((rn: PlanNode, i: number) => {
        const type = String(rn?.type || "llm") as NodeKind;
        const id = String(rn?.id || `${type}-${nanoid(6)}`);
        const position = rn?.position || { x: 100 + i * 300, y: 200 };

        // 支持两种格式：data 对象或直接属性
        const d = rn?.data || {};
        const label = String(d?.label || rn?.label || type.toUpperCase());

        // 通用属性提取函数
        const get = <T>(key: keyof PlanNodeData): T | undefined => {
            return (d?.[key] ?? (rn as Record<string, unknown>)?.[key]) as T | undefined;
        };

        let data: AppNodeData = { label, status: "idle" };

        if (type === "input") {
            // 保留所有 Input 节点配置
            const enableFileInput = get<boolean>('enableFileInput') ?? false;
            const enableStructuredForm = get<boolean>('enableStructuredForm') ?? false;

            // 处理文件配置：如果启用了文件输入但没有配置，提供默认配置
            let fileConfig = get<PlanNodeData['fileConfig']>('fileConfig');
            if (enableFileInput && (!fileConfig || !fileConfig.allowedTypes || fileConfig.allowedTypes.length === 0)) {
                // 根据标签推断文件类型，默认支持常见文件类型
                const labelLower = label.toLowerCase();
                let defaultTypes: string[] = [];
                if (labelLower.includes('图片') || labelLower.includes('截图') || labelLower.includes('image') || labelLower.includes('photo')) {
                    defaultTypes = ['image/*'];
                } else if (labelLower.includes('文档') || labelLower.includes('文件') || labelLower.includes('doc')) {
                    defaultTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
                } else {
                    // 默认支持常见文件类型
                    defaultTypes = ['image/*', '.pdf', '.doc', '.docx', '.txt', '.md'];
                }
                fileConfig = {
                    allowedTypes: defaultTypes,
                    maxFileSize: fileConfig?.maxFileSize ?? 10,
                    maxFileCount: fileConfig?.maxFileCount ?? 5,
                };
            }

            // 处理表单字段：如果启用了结构化表单但没有字段，提供默认字段
            let formFields = get<PlanNodeData['formFields']>('formFields') || [];
            if (enableStructuredForm && formFields.length === 0) {
                // 根据标签推断表单字段
                formFields = [{
                    id: `field_${Date.now()}`,
                    type: 'text',
                    label: '参数',
                    required: false,
                }];
            }

            data = {
                label,
                status: "idle",
                text: String(get<string>('text') || ""),
                enableTextInput: get<boolean>('enableTextInput') ?? true,
                enableFileInput,
                enableStructuredForm,
                fileConfig,
                formFields,
            } as AppNodeData;
        } else if (type === "llm") {
            // 保留所有 LLM 节点配置，包括 enableMemory
            data = {
                label,
                status: "idle",
                model: String(get<string>('model') || "qwen-flash"),
                temperature: typeof get<number>('temperature') === "number" ? get<number>('temperature') : 0.7,
                systemPrompt: String(get<string>('systemPrompt') || ""),
                enableMemory: get<boolean>('enableMemory') ?? false,
                memoryMaxTurns: get<number>('memoryMaxTurns') ?? 10,
            } as AppNodeData;
        } else if (type === "rag") {
            // 保留所有 RAG 节点配置
            const filesRaw = get<PlanNodeData['files']>('files') || [];
            const processedFiles = (Array.isArray(filesRaw) ? filesRaw : []).map((f) =>
                typeof f === "string"
                    ? { name: f }
                    : { name: String(f.name || "文件"), size: f.size, type: f.type, url: f.url }
            );
            data = {
                label,
                status: "idle",
                files: processedFiles,
                topK: get<number>('topK') ?? 5,
                maxTokensPerChunk: get<number>('maxTokensPerChunk') ?? 200,
                maxOverlapTokens: get<number>('maxOverlapTokens') ?? 50,
            } as AppNodeData;
        } else if (type === "branch") {
            // 🚨 保留 Branch 节点的 condition
            data = {
                label,
                status: "idle",
                condition: String(get<string>('condition') || ""),
            } as AppNodeData;
        } else if (type === "tool") {
            // 保留 Tool 节点配置
            data = {
                label,
                status: "idle",
                toolType: String(get<string>('toolType') || "web_search"),
                inputs: get<Record<string, unknown>>('inputs') || {},
            } as AppNodeData;
        } else if ((type as string) === "http") {
            data = {
                label,
                status: "idle",
                method: String(get<string>('method') || "GET"),
                url: String(get<string>('url') || ""),
            } as AppNodeData;
        } else if (type === "output") {
            data = { label, status: "idle", text: String(get<string>('text') || "") } as AppNodeData;
        }

        return { id, type, position, data } as AppNode;
    });

    // 构建 ID 映射
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
            // 🚨 保留 sourceHandle（用于 Branch 节点的 true/false 路径）
            if (re?.sourceHandle) {
                edge.sourceHandle = re.sourceHandle;
            }
            edges.push(edge);
        }
    }

    // 如果没有边，自动生成默认连接
    if (edges.length === 0 && nodes.length) {
        const ins = nodes.filter((n) => n.type === "input");
        const rags = nodes.filter((n) => n.type === "rag");
        const https = nodes.filter((n) => (n.type as string) === "http");
        const llms = nodes.filter((n) => n.type === "llm");
        const branches = nodes.filter((n) => n.type === "branch");
        const tools = nodes.filter((n) => n.type === "tool");
        const outs = nodes.filter((n) => n.type === "output");

        const chain: AppNode[] = [];
        if (ins[0]) chain.push(ins[0]);
        for (const n of rags) chain.push(n);
        for (const n of https) chain.push(n);
        for (const n of tools) chain.push(n);
        for (const n of llms) chain.push(n);
        for (const n of branches) chain.push(n);
        if (outs[0]) chain.push(outs[0]);

        for (let i = 0; i < chain.length - 1; i++) {
            edges.push({ id: `e-${chain[i].id}-${chain[i + 1].id}-${nanoid(4)}`, source: chain[i].id, target: chain[i + 1].id });
        }

        for (let i = 1; i < llms.length; i++) {
            if (outs[0]) edges.push({ id: `e-${llms[i].id}-${outs[0].id}-${nanoid(4)}`, source: llms[i].id, target: outs[0].id });
        }
    }

    return { nodes, edges };
}

