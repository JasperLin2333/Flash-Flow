import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { NODE_REFERENCE } from "@/lib/prompts";
import { generateEmbeddingsBatch } from "@/lib/embeddings";

const ROOT = process.cwd();

function loadEnv() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) {
      dotenv.config({ path: full, override: true });
    }
  }
}

type NodeType = "input" | "llm" | "rag" | "tool" | "branch" | "imagegen" | "output";

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  input: "Input",
  llm: "LLM",
  rag: "RAG",
  tool: "Tool",
  branch: "Branch",
  imagegen: "ImageGen",
  output: "Output",
};

const KEYWORDS: Record<NodeType, string[]> = {
  input: ["input", "输入", "表单", "上传"],
  llm: ["llm", "大模型", "生成", "对话"],
  rag: ["rag", "检索", "知识库", "文档"],
  tool: ["tool", "工具", "接口", "api", "搜索"],
  branch: ["branch", "分支", "条件", "判断"],
  imagegen: ["imagegen", "图像", "图片", "绘图"],
  output: ["output", "输出", "结果", "响应"],
};

function extractNodeReferenceSections() {
  const sections: Record<NodeType, string> = {
    input: "",
    llm: "",
    rag: "",
    tool: "",
    branch: "",
    imagegen: "",
    output: "",
  };

  const matches: Array<{ start: number; heading: string }> = [];
  const pattern = /##\s+\d+\.\s+([^\n]+)\n/g;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(NODE_REFERENCE)) !== null) {
    matches.push({ start: match.index, heading: match[1] || "" });
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

  return sections;
}

function splitSectionIntoChunks(section: string) {
  const lines = section.split(/\r?\n/);
  if (lines.length === 0) return [];

  const topHeadingIndex = lines.findIndex((line) => line.startsWith("## "));
  const topHeading = topHeadingIndex >= 0 ? lines[topHeadingIndex] : "";
  const bodyLines = topHeadingIndex >= 0 ? lines.slice(topHeadingIndex + 1) : lines;

  const chunks: Array<{ title: string; content: string }> = [];
  let currentTitle = "概览";
  let currentLines: string[] = [];

  const flush = () => {
    const contentLines = [];
    if (topHeading) contentLines.push(topHeading);
    contentLines.push(...currentLines);
    const content = contentLines.join("\n").trim();
    if (content) {
      chunks.push({ title: currentTitle, content });
    }
  };

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) {
      if (currentLines.length > 0) flush();
      currentTitle = trimmed.replace(/^####?\s+/, "").trim() || "概览";
      currentLines = [line];
      continue;
    }
    if (currentLines.length === 0 && trimmed) {
      currentLines = [line];
      continue;
    }
    currentLines.push(line);
  }

  if (currentLines.length > 0) flush();

  return chunks.length > 0 ? chunks : [{ title: "概览", content: section.trim() }];
}

function buildDocs(category: string, chunked: boolean) {
  const sections = extractNodeReferenceSections();
  const docs: Array<{ title: string; content: string; category: string; keywords: string[]; metadata: Record<string, unknown> }> = [];

  (Object.keys(sections) as NodeType[]).forEach((type) => {
    const content = sections[type];
    if (!content) return;
    if (!chunked) {
      docs.push({
        title: `Node Reference - ${NODE_TYPE_LABELS[type]}`,
        content,
        category,
        keywords: Array.from(new Set([type, "node", "节点", "reference", "规范", ...KEYWORDS[type]])),
        metadata: {
          source: "node_reference",
          node_type: type,
          version: "v1",
          chunked: false,
        },
      });
      return;
    }

    const chunks = splitSectionIntoChunks(content);
    chunks.forEach((chunk, idx) => {
      const sectionTitle = chunk.title || `Part ${idx + 1}`;
      docs.push({
        title: `Node Reference - ${NODE_TYPE_LABELS[type]} - ${sectionTitle}`,
        content: chunk.content,
        category,
        keywords: Array.from(
          new Set([type, "node", "节点", "reference", "规范", sectionTitle, ...KEYWORDS[type]])
        ),
        metadata: {
          source: "node_reference",
          node_type: type,
          section: sectionTitle,
          version: "v2",
          chunked: true,
        },
      });
    });
  });

  return docs;
}

async function main() {
  loadEnv();

  const args = new Set(process.argv.slice(2));
  const categoryArg = [...args].find((arg) => arg.startsWith("--category="));
  const category = categoryArg ? categoryArg.split("=")[1] : "node";
  const shouldTruncate = args.has("--truncate");
  const dryRun = args.has("--dry-run");
  const skipEmbeddings = args.has("--skip-embeddings");
  const chunked = !args.has("--legacy") && !args.has("--no-chunk");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  const docs = buildDocs(category, chunked);
  if (docs.length === 0) {
    console.log("No node reference sections found. Abort.");
    return;
  }

  console.log(`Preparing ${docs.length} docs (category=${category}, chunked=${chunked}).`);

  if (dryRun) {
    console.log("Dry run enabled. Exiting without writing.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  if (shouldTruncate) {
    const { error } = await supabase.from("agent_docs").delete().not("id", "is", null);
    if (error) {
      throw new Error(`Failed to truncate agent_docs: ${error.message}`);
    }
    console.log("Truncated agent_docs.");
  }

  const contents = docs.map((doc) => doc.content);
  let embeddings: Array<number[] | null> = [];
  if (skipEmbeddings) {
    embeddings = contents.map(() => null);
    console.log("Skipping embeddings (search will not work until embeddings are backfilled).");
  } else {
    try {
      embeddings = await generateEmbeddingsBatch(contents);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Embedding request failed. Check EMBEDDING_PROVIDER settings, API key, base URL, and network access. Details: ${message}`
      );
    }
  }

  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i];
    const embedding = embeddings[i];
    await supabase.from("agent_docs").delete().eq("title", doc.title);
    const { error } = await supabase.from("agent_docs").insert({
      title: doc.title,
      content: doc.content,
      category: doc.category,
      keywords: doc.keywords,
      metadata: doc.metadata,
      embedding,
    });
    if (error) {
      throw new Error(`Failed to insert ${doc.title}: ${error.message}`);
    }
  }

  console.log("Seed completed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
