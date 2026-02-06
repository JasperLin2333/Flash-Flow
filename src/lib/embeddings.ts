import OpenAI from "openai";

type EmbeddingProvider = "siliconflow" | "volcengine";

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

let cachedClient: OpenAI | null = null;
let cachedConfig: EmbeddingConfig | null = null;

function resolveTargetDimension(): number | null {
  const raw =
    process.env.AGENT_DOCS_EMBEDDING_DIM ||
    process.env.EMBEDDING_DIM ||
    "1024";
  const dim = Number(raw);
  if (!Number.isFinite(dim) || dim <= 0) return null;
  return Math.floor(dim);
}

function normalizeEmbedding(vector: number[]): number[] {
  const target = resolveTargetDimension();
  if (!target) return vector;
  if (vector.length === target) return vector;
  if (vector.length > target) return vector.slice(0, target);
  const padded = vector.slice();
  while (padded.length < target) padded.push(0);
  return padded;
}

function isMultimodalEmbedding(model: string) {
  const mode =
    process.env.DOUBAO_EMBEDDING_MODE ||
    process.env.VOLCENGINE_EMBEDDING_MODE ||
    process.env.ARK_EMBEDDING_MODE ||
    "";
  if (mode.toLowerCase() === "multimodal") return true;
  return model.toLowerCase().includes("vision");
}

function resolveEmbeddingConfig(): EmbeddingConfig {
  const provider = (process.env.EMBEDDING_PROVIDER || "siliconflow").toLowerCase() as EmbeddingProvider;

  if (provider === "volcengine") {
    const apiKey =
      process.env.DOUBAO_API_KEY ||
      process.env.VOLCENGINE_API_KEY ||
      process.env.ARK_API_KEY ||
      "";
    const baseURL =
      process.env.DOUBAO_BASE_URL ||
      process.env.VOLCENGINE_BASE_URL ||
      process.env.ARK_BASE_URL ||
      "https://ark.cn-beijing.volces.com/api/v3";
    const model =
      process.env.DOUBAO_EMBEDDING_MODEL ||
      process.env.VOLCENGINE_EMBEDDING_MODEL ||
      process.env.ARK_EMBEDDING_MODEL ||
      "";

    if (!apiKey) {
      throw new Error("Missing DOUBAO_API_KEY (or VOLCENGINE_API_KEY / ARK_API_KEY) for embeddings.");
    }
    if (!model) {
      throw new Error(
        "Missing DOUBAO_EMBEDDING_MODEL (or VOLCENGINE_EMBEDDING_MODEL / ARK_EMBEDDING_MODEL) for embeddings."
      );
    }

    return { provider, apiKey, baseURL, model };
  }

  const apiKey = process.env.SILICONFLOW_API_KEY || "";
  const baseURL = process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1";
  const model = process.env.SILICONFLOW_EMBEDDING_MODEL || "BAAI/bge-m3";

  if (!apiKey) {
    throw new Error("Missing SILICONFLOW_API_KEY for embeddings.");
  }

  return { provider: "siliconflow", apiKey, baseURL, model };
}

function getClient() {
  const config = resolveEmbeddingConfig();
  const shouldReuse =
    cachedClient &&
    cachedConfig &&
    cachedConfig.provider === config.provider &&
    cachedConfig.apiKey === config.apiKey &&
    cachedConfig.baseURL === config.baseURL &&
    cachedConfig.model === config.model;

  if (shouldReuse && cachedClient) {
    return { client: cachedClient, config };
  }

  cachedConfig = config;
  cachedClient = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  return { client: cachedClient, config };
}

async function requestVolcengineEmbeddings(
  config: EmbeddingConfig,
  inputs: string[]
): Promise<number[][]> {
  const useMultimodal = isMultimodalEmbedding(config.model);
  if (!useMultimodal) {
    const { client } = getClient();
    const response = await client.embeddings.create({
      model: config.model,
      input: inputs,
    });
    return response.data.map((d) => d.embedding);
  }

  const base = config.baseURL.replace(/\/+$/, "");
  const url = `${base}/embeddings/multimodal`;
  const payload = {
    model: config.model,
    input: inputs.map((text) => ({ type: "text", text })),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Volcengine multimodal embeddings failed (${resp.status}): ${text}`);
  }

  const responsePayload = (await resp.json()) as {
    data?: Array<{ embedding?: number[] }> | { embedding?: number[] } | { embeddings?: number[][] };
  };
  const raw = responsePayload?.data;
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error("Volcengine multimodal embeddings returned empty data array.");
    }
    return raw.map((row) => row.embedding || []);
  }
  if (raw && Array.isArray((raw as { embeddings?: number[][] }).embeddings)) {
    return (raw as { embeddings: number[][] }).embeddings;
  }
  if (raw && Array.isArray((raw as { embedding?: number[] }).embedding)) {
    return [(raw as { embedding: number[] }).embedding];
  }
  throw new Error("Volcengine multimodal embeddings returned no usable embedding data.");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const { client, config } = getClient();
  if (config.provider === "volcengine") {
    const embeddings = await requestVolcengineEmbeddings(config, [text]);
    return normalizeEmbedding(embeddings[0]);
  }

  const response = await client.embeddings.create({
    model: config.model,
    input: text,
  });

  return normalizeEmbedding(response.data[0].embedding);
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const { client, config } = getClient();
  if (config.provider === "volcengine") {
    const embeddings = await requestVolcengineEmbeddings(config, texts);
    return embeddings.map(normalizeEmbedding);
  }

  const response = await client.embeddings.create({
    model: config.model,
    input: texts,
  });

  return response.data.map((d) => normalizeEmbedding(d.embedding));
}
