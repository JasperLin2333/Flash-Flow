import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error("Missing Supabase environment variables");
}

/**
 * Browser-side Supabase client
 * Uses @supabase/ssr to automatically synchronize session with cookies
 */
export const supabase = createBrowserClient<Database>(url, anon);

// Helper for consistency
export function getSupabaseClient() {
  return supabase;
}
