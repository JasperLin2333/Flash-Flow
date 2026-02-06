import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/embeddings";

export interface FlowCaseRagOptions {
  prompt: string;
  planBlock?: string | null;
  enableRag?: boolean;
  topK?: number;
  threshold?: number;
  category?: string;
}

export interface FlowCaseRagResult {
  cases: Array<{ title: string; content: string }>;
  source: "rag" | "none";
  ragCount: number;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon);
}

export async function getFlowCaseFewShots(
  options: FlowCaseRagOptions
): Promise<FlowCaseRagResult> {
  const {
    prompt,
    planBlock,
    enableRag = true,
    topK = 1,
    threshold = 0.45,
    category = "flow_case",
  } = options;

  if (!enableRag) {
    return { cases: [], source: "none", ragCount: 0 };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { cases: [], source: "none", ragCount: 0 };
  }

  try {
    const query = [
      "工作流案例",
      prompt,
      planBlock ? `\n${planBlock}` : "",
    ].join(" ");

    const embedding = await generateEmbedding(query);
    const { data, error } = await supabase.rpc("match_agent_docs", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: Math.max(1, Math.min(topK, 3)),
      category_filter: category,
    });

    if (error || !data || data.length === 0) {
      return { cases: [], source: "none", ragCount: 0 };
    }

    const cases = data
      .map((item: { title?: string; content?: string }) => ({
        title: item?.title || "",
        content: item?.content || "",
      }))
      .filter((item) => item.content && item.content.trim().length > 0);

    if (cases.length === 0) {
      return { cases: [], source: "none", ragCount: 0 };
    }

    return { cases, source: "rag", ragCount: cases.length };
  } catch {
    return { cases: [], source: "none", ragCount: 0 };
  }
}
