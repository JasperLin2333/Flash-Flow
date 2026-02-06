import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import https from "https";
import http from "http";
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

function slugify(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii;
}

function buildTags(nodes: Array<{ type?: string }>) {
  const types = Array.from(
    new Set(nodes.map((n) => String(n?.type || "unknown").toLowerCase()))
  );
  return types.map((t) => `node:${t}`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sampleArray<T>(list: T[], count: number) {
  if (list.length <= count) return list;
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

async function main() {
  loadEnv();

  const args = new Set(process.argv.slice(2));
  const dirArg = [...args].find((arg) => arg.startsWith("--dir="));
  const limitArg = [...args].find((arg) => arg.startsWith("--limit="));
  const ownerArg = [...args].find((arg) => arg.startsWith("--owner="));
  const minNodesArg = [...args].find((arg) => arg.startsWith("--min-nodes="));
  const sampleArg = [...args].find((arg) => arg.startsWith("--sample="));
  const overwrite = args.has("--overwrite");
  const dryRun = args.has("--dry-run");

  const dir = dirArg ? dirArg.split("=")[1] : path.join(ROOT, "docs", "flow-cases");
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 5;
  const ownerId = ownerArg ? ownerArg.split("=")[1] : null;
  const minNodes = minNodesArg ? Number(minNodesArg.split("=")[1]) : 2;
  const sampleMode = sampleArg ? sampleArg.split("=")[1] : "recent";

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("Invalid --limit value.");
  }
  if (!Number.isFinite(minNodes) || minNodes < 0) {
    throw new Error("Invalid --min-nodes value.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("select", "id,name,description,data,updated_at,created_at,owner_id");
  params.set("order", "updated_at.desc");
  params.set("limit", "200");
  if (ownerId) {
    params.set("owner_id", `eq.${ownerId}`);
  }

  const requestUrl = `${baseUrl}/rest/v1/flows?${params.toString()}`;
  async function fetchFlowsOnce() {
    return new Promise<Array<any>>((resolve, reject) => {
      const url = new URL(requestUrl);
      const client = url.protocol === "http:" ? http : https;
      const req = client.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === "http:" ? 80 : 443),
          path: `${url.pathname}${url.search}`,
          method: "GET",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(body));
              } catch (err) {
                reject(new Error(`Failed to parse response JSON: ${body.slice(0, 200)}`));
              }
            } else {
              reject(new Error(`Failed to fetch flows: ${res.statusCode} ${body.slice(0, 200)}`));
            }
          });
        }
      );
      req.on("error", (err) => reject(new Error(`Failed to fetch flows (network): ${err.message}`)));
      req.setTimeout(15000, () => {
        req.destroy(new Error("Request timeout after 15s"));
      });
      req.end();
    });
  }

  let data: Array<any> = [];
  const maxAttempts = 3;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      data = await fetchFlowsOnce();
      lastError = null;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  if (lastError) throw lastError;

  const flows = (data || [])
    .map((row: any) => {
      const data = row.data || {};
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      const edges = Array.isArray(data.edges) ? data.edges : [];
      return {
        id: row.id,
        name: row.name || "未命名工作流",
        description: row.description || "",
        nodes,
        edges,
        updated_at: row.updated_at,
      };
    })
    .filter((item) => item.nodes.length >= minNodes && item.edges.length >= 0);

  const candidates = sampleMode === "random"
    ? sampleArray(flows, limit)
    : flows.slice(0, limit);

  if (candidates.length === 0) {
    console.log("No flows matched the filter. Export skipped.");
    return;
  }

  ensureDir(dir);

  if (dryRun) {
    console.log(`Dry run: would export ${candidates.length} flows to ${dir}`);
    candidates.forEach((flow) => {
      console.log(`- ${flow.name} (${flow.id}) nodes=${flow.nodes.length}`);
    });
    return;
  }

  let written = 0;
  for (const flow of candidates) {
    const slug = slugify(flow.name);
    const baseName = slug ? `${slug}-${flow.id.slice(0, 8)}` : `flow-${flow.id.slice(0, 8)}`;
    const filePath = path.join(dir, `${baseName}.json`);

    if (!overwrite && fs.existsSync(filePath)) {
      console.log(`Skip (exists): ${filePath}`);
      continue;
    }

    const payload = {
      title: flow.name,
      goal: flow.description || flow.name,
      tags: buildTags(flow.nodes),
      workflow: {
        title: flow.name,
        nodes: flow.nodes,
        edges: flow.edges,
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    written += 1;
  }

  console.log(`Exported ${written} flow cases to ${dir}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
