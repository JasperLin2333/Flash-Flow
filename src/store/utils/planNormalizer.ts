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
};

export type Plan = {
    title?: string;
    nodes?: PlanNode[];
    edges?: PlanEdge[]
};

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
        
        // 支持两种格式：data 对象或直接属性
        const d = rn?.data || {};
        const label = String(d?.label || rn?.label || type.toUpperCase());
        const text = d?.text ?? rn?.text;
        const model = d?.model ?? rn?.model;
        const temperature = d?.temperature ?? rn?.temperature;
        const systemPrompt = d?.systemPrompt ?? rn?.systemPrompt;
        const files = d?.files ?? rn?.files;
        const method = d?.method ?? rn?.method;
        const url = d?.url ?? rn?.url;

        let data: AppNodeData = { label, status: "idle" };

        if (type === "input") {
            data = { label, status: "idle", text: String(text || "") } as AppNodeData;
        } else if (type === "llm") {
            data = {
                label,
                status: "idle",
                model: String(model || "doubao-seed-1-6-flash-250828"),
                temperature: typeof temperature === "number" ? temperature : 0.7,
                systemPrompt: String(systemPrompt || ""),
            } as AppNodeData;
        } else if (type === "rag") {
            const filesRaw = Array.isArray(files) ? files : [];
            const processedFiles = filesRaw.map((f) =>
                typeof f === "string"
                    ? { name: f }
                    : { name: String(f.name || "文件"), size: f.size, type: f.type, url: f.url }
            );
            data = { label, status: "idle", files: processedFiles } as AppNodeData;
        } else if (type === "http") {
            data = { label, status: "idle", method: String(method || "GET"), url: String(url || "") } as AppNodeData;
        } else if (type === "output") {
            data = { label, status: "idle", text: String(text || "") } as AppNodeData;
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
            edges.push({ id: `e-${sid}-${tid}-${nanoid(4)}`, source: sid, target: tid });
        }
    }

    // 如果没有边，自动生成默认连接
    if (edges.length === 0 && nodes.length) {
        const ins = nodes.filter((n) => n.type === "input");
        const rags = nodes.filter((n) => n.type === "rag");
        const https = nodes.filter((n) => n.type === "http");
        const llms = nodes.filter((n) => n.type === "llm");
        const outs = nodes.filter((n) => n.type === "output");

        const chain: AppNode[] = [];
        if (ins[0]) chain.push(ins[0]);
        for (const n of rags) chain.push(n);
        for (const n of https) chain.push(n);
        for (const n of llms) chain.push(n);
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
