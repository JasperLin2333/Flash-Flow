import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/embeddings";
import { NODE_REFERENCE } from "@/lib/prompts";

export type NodeType = "input" | "llm" | "rag" | "tool" | "branch" | "imagegen" | "output";

export interface NodeReferenceRagOptions {
  prompt: string;
  planBlock?: string | null;
  enableRag?: boolean;
  topK?: number;
  threshold?: number;
  category?: string;
}

export interface NodeReferenceRagResult {
  reference: string;
  source: "rag" | "fallback";
  types: NodeType[];
  ragCount?: number;
}

const DEFAULT_NODE_TYPES: NodeType[] = ["input", "llm", "output"];
const NODE_TYPE_ORDER: NodeType[] = [
  "input",
  "llm",
  "rag",
  "tool",
  "branch",
  "imagegen",
  "output",
];

const TYPE_KEYWORDS: Record<NodeType, string[]> = {
  input: ["输入", "表单", "上传"],
  llm: ["大模型", "LLM", "生成", "对话", "改写", "润色"],
  rag: ["知识库", "检索", "RAG", "文档", "资料", "引用"],
  tool: ["工具", "搜索", "查询", "接口", "API", "爬取", "计算", "时间", "日期"],
  branch: ["分支", "条件", "判断", "如果", "否则", "逻辑"],
  imagegen: ["图片", "图像", "绘图", "生成图", "海报"],
  output: ["输出", "结果", "响应"],
};

let cachedSections: Record<NodeType, string> | null = null;

function extractNodeReferenceSections(): Record<NodeType, string> {
  if (cachedSections) return cachedSections;

  const sections: Record<NodeType, string> = {
    input: "",
    llm: "",
    rag: "",
    tool: "",
    branch: "",
    imagegen: "",
    output: "",
  };

  const matches: Array<{ start: number; end: number; heading: string }> = [];
  const pattern = /##\s+\d+\.\s+([^\n]+)\n/g;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(NODE_REFERENCE)) !== null) {
    matches.push({ start: match.index, end: match.index, heading: match[1] || "" });
  }

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.start;
    const end = next ? next.start : NODE_REFERENCE.length;
    const block = NODE_REFERENCE.slice(start, end).trim();
    const heading = current.heading.toLowerCase();

    if (heading.includes("input")) sections.input = block;
    else if (heading.includes("llm")) sections.llm = block;
    else if (heading.includes("rag")) sections.rag = block;
    else if (heading.includes("tool")) sections.tool = block;
    else if (heading.includes("branch")) sections.branch = block;
    else if (heading.includes("imagegen")) sections.imagegen = block;
    else if (heading.includes("output")) sections.output = block;
  }

  cachedSections = sections;
  return sections;
}

function buildReferenceFromTypes(types: NodeType[]) {
  const sections = extractNodeReferenceSections();
  const ordered = NODE_TYPE_ORDER.filter((t) => types.includes(t));
  const blocks = ordered.map((t) => sections[t]).filter(Boolean);
  return [
    "# 📦 节点类型参考手册 (Node Reference)",
    "> 仅包含本次生成可能用到的节点类型。",
    "",
    ...blocks,
  ].join("\n");
}

export function inferNodeTypesFromPlan(planBlock?: string | null): NodeType[] {
  if (!planBlock) return [];
  const set = new Set<NodeType>();
  const matches = planBlock.match(/\[type:([a-z_]+)\]/gi) || [];
  for (const raw of matches) {
    const match = raw.match(/\[type:([a-z_]+)\]/i);
    const type = (match?.[1] || "").toLowerCase();
    if (type === "image" || type === "image_gen" || type === "imagegen") set.add("imagegen");
    else if (type === "llm") set.add("llm");
    else if (type === "rag") set.add("rag");
    else if (type === "tool") set.add("tool");
    else if (type === "branch") set.add("branch");
    else if (type === "input") set.add("input");
    else if (type === "output") set.add("output");
  }
  return Array.from(set);
}

export function inferNodeTypesFromPrompt(prompt: string): NodeType[] {
  const set = new Set<NodeType>();
  const content = prompt.toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((kw) => content.includes(kw.toLowerCase()))) {
      set.add(type as NodeType);
    }
  }
  return Array.from(set);
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon);
}

function extractNodeTypeFromTitle(title?: string): NodeType | null {
  if (!title) return null;
  const lower = title.toLowerCase();
  if (lower.includes("node reference - input")) return "input";
  if (lower.includes("node reference - llm")) return "llm";
  if (lower.includes("node reference - rag")) return "rag";
  if (lower.includes("node reference - tool")) return "tool";
  if (lower.includes("node reference - branch")) return "branch";
  if (lower.includes("node reference - imagegen")) return "imagegen";
  if (lower.includes("node reference - output")) return "output";
  return null;
}

export async function getNodeReferenceForPrompt(
  options: NodeReferenceRagOptions
): Promise<NodeReferenceRagResult> {
  const {
    prompt,
    planBlock,
    enableRag = true,
    topK = 6,
    threshold = 0.6,
    category,
  } = options;

  const planTypes = inferNodeTypesFromPlan(planBlock);
  const promptTypes = inferNodeTypesFromPrompt(prompt);
  const types = Array.from(new Set<NodeType>([...DEFAULT_NODE_TYPES, ...planTypes, ...promptTypes]));
  const fallback = buildReferenceFromTypes(types);

  if (!enableRag) {
    return { reference: fallback, source: "fallback", types };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { reference: fallback, source: "fallback", types };
  }

  try {
    const query = `工作流节点 ${types.join(" ")} ${prompt}`.trim();
    const embedding = await generateEmbedding(query);
    const { data, error } = await supabase.rpc("match_agent_docs", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: Math.max(1, Math.min(topK, 10)),
      category_filter: category || null,
    });

    if (error || !data || data.length === 0) {
      return { reference: fallback, source: "fallback", types };
    }

    const typeSet = new Set(types);
    const filtered = data.filter((item: { title?: string }) => {
      const nodeType = extractNodeTypeFromTitle(item?.title);
      if (!nodeType) return false;
      return typeSet.has(nodeType);
    });

    const selected = filtered.length > 0 ? filtered : data;

    const blocks = selected
      .map((item: { title?: string; content?: string }) => {
        const title = item?.title ? `### ${item.title}` : "";
        const content = item?.content || "";
        return [title, content].filter(Boolean).join("\n");
      })
      .filter(Boolean);

    if (blocks.length === 0) {
      return { reference: fallback, source: "fallback", types };
    }

    const reference = [
      "# 📦 节点类型参考手册 (RAG 命中)",
      "> 仅包含本次生成可能用到的节点类型（来自检索结果）。",
      "",
      ...blocks,
    ].join("\n");

    return { reference, source: "rag", types, ragCount: blocks.length };
  } catch {
    return { reference: fallback, source: "fallback", types };
  }
}
