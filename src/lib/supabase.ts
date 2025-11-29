import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error("Missing Supabase environment variables");
}

// Client for browser usage
export const supabase = createClient<Database>(url, anon);

// Server client (for API routes if needed)
export function getSupabaseClient() {
  return supabase;
}
