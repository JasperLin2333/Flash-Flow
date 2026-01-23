import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { generateEmbeddingsBatch } from "../src/lib/embeddings";

dotenv.config({ path: ".env.local" });
import { DOCUMENTATION_CORPUS } from "../src/lib/agent/tools";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("🚀 Starting agent docs initialization...");

  const docs = DOCUMENTATION_CORPUS.map((doc: any) => ({
    title: doc.title,
    content: doc.content,
    keywords: doc.keywords,
    category: "node",
    metadata: { keywords: doc.keywords },
  }));

  console.log(`📝 Generating embeddings for ${docs.length} docs...`);
  const texts = docs.map((d: any) => `${d.title}\n\n${d.content}`);
  const embeddings = await generateEmbeddingsBatch(texts);

  console.log("💾 Inserting into database...");
  const records = docs.map((doc: any, i: number) => ({
    title: doc.title,
    content: doc.content,
    keywords: doc.keywords,
    category: "node",
    metadata: { keywords: doc.keywords },
    embedding: embeddings[i],
  }));

  const { error } = await supabase.from("agent_docs").insert(records);

  if (error) {
    console.error("❌ Error:", error);
  } else {
    console.log("✅ Success! Agent docs initialized.");
  }
}

main().catch(console.error);
