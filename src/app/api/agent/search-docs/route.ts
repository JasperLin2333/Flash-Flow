import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const { query, topK = 3, category } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    console.log("[Vector Search] Query:", query, "TopK:", topK, "Category:", category || "none");

    const queryEmbedding = await generateEmbedding(query);

    let queryBuilder = supabase.rpc("match_agent_docs", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: topK,
    });

    if (category) {
      queryBuilder = queryBuilder.eq("category", category);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const latency = Date.now() - startTime;

    return NextResponse.json({
      results: data || [],
      query,
      count: data?.length || 0,
      latency: latency + "ms",
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
