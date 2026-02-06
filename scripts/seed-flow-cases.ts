import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateEmbedding } from "@/lib/embeddings";

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

function safeParseJson(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeCasePayload(payload: any, fileName: string) {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid JSON payload in ${fileName}`);
  }

  const title = String(payload.title || payload.name || path.basename(fileName, ".json"));
  const goal = String(payload.goal || payload.intent || payload.description || "").trim();
  const tags = Array.isArray(payload.tags) ? payload.tags.map(String) : [];

  const workflow = payload.workflow && typeof payload.workflow === "object"
    ? payload.workflow
    : { nodes: payload.nodes, edges: payload.edges, title: payload.workflowTitle || payload.title };

  if (!Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) {
    throw new Error(`Missing nodes/edges in ${fileName}. Expect workflow.nodes & workflow.edges.`);
  }

  const content = JSON.stringify(
    {
      title,
      goal,
      tags,
      workflow,
    },
    null,
    2
  );

  const nodeTypes = Array.from(new Set(workflow.nodes.map((n: any) => String(n?.type || "unknown"))));
  const indexText = [
    title,
    goal,
    tags.join(" "),
    `nodes:${workflow.nodes.length}`,
    `edges:${workflow.edges.length}`,
    nodeTypes.join(" "),
  ]
    .filter(Boolean)
    .join("\n");

  return { title, goal, tags, workflow, content, indexText };
}

async function main() {
  loadEnv();

  const args = new Set(process.argv.slice(2));
  const dirArg = [...args].find((arg) => arg.startsWith("--dir="));
  const categoryArg = [...args].find((arg) => arg.startsWith("--category="));
  const dir = dirArg ? dirArg.split("=")[1] : path.join(ROOT, "docs", "flow-cases");
  const category = categoryArg ? categoryArg.split("=")[1] : "flow_case";
  const shouldTruncate = args.has("--truncate");
  const dryRun = args.has("--dry-run");

  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No JSON files found for flow cases.");
    return;
  }

  const cases = files.map((file) => normalizeCasePayload(safeParseJson(path.join(dir, file)), file));

  console.log(`Preparing ${cases.length} flow cases (category=${category}).`);

  if (dryRun) {
    console.log("Dry run enabled. Exiting without writing.");
    return;
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, "");

  async function httpRequest(pathname: string, method: string, body?: unknown) {
    const url = `${baseUrl}${pathname}`;
    const maxAttempts = 3;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const resp = await fetch(url, {
          method,
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`Supabase request failed: ${resp.status} ${text}`);
        }
        if (resp.status === 204) return null;
        if (method === "DELETE") return null;
        const text = await resp.text().catch(() => "");
        return text ? JSON.parse(text) : null;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError ?? new Error("Supabase request failed");
  }

  if (shouldTruncate) {
    await httpRequest(
      `/rest/v1/agent_docs?category=eq.${encodeURIComponent(category)}`,
      "DELETE"
    );
    console.log(`Truncated agent_docs where category=${category}.`);
  }

  for (const item of cases) {
    const embedding = await generateEmbedding(item.indexText);
    await httpRequest(
      `/rest/v1/agent_docs?title=eq.${encodeURIComponent(item.title)}&category=eq.${encodeURIComponent(category)}`,
      "DELETE"
    );
    await httpRequest(`/rest/v1/agent_docs`, "POST", {
      title: item.title,
      content: item.content,
      category,
      keywords: Array.from(new Set([item.title, ...item.tags])),
      metadata: {
        source: "flow_case",
        goal: item.goal,
        tags: item.tags,
        node_types: Array.from(new Set(item.workflow.nodes.map((n: any) => n?.type).filter(Boolean))),
      },
      embedding,
    });
  }

  console.log("Flow case seed completed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
