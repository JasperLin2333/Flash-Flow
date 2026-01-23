import OpenAI from "openai";

let openai: OpenAI | null = null;

function getClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: "https://api.siliconflow.cn/v1",
    });
  }
  return openai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: "BAAI/bge-m3",
    input: text,
  });

  return response.data[0].embedding;
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: "BAAI/bge-m3",
    input: texts,
  });

  return response.data.map((d) => d.embedding);
}
