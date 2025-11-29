import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const env_ok = Boolean(url && (anon || service));
  let connected = false;
  let auth_ok = false;
  let table_ok = false;
  let error: string | null = null;

  if (!supabase) {
    return NextResponse.json({ env_ok, connected, auth_ok, table_ok, error: "missing env" });
  }

  try {
    if (url) {
      const key = service || anon || "";
      const resp = await fetch(`${url}/rest/v1`, {
        method: "HEAD",
        headers: { apikey: key },
      });
      connected = resp.ok || resp.status === 401 || resp.status === 404;
      auth_ok = resp.status !== 401;
    }
    const { data, error: err } = await supabase.from("flows").select("id").limit(1);
    if (err) {
      error = err.message;
      const msg = String(err.message || "").toLowerCase();
      if (msg.includes("failed to fetch") || msg.includes("network")) {
        connected = false;
      } else {
        connected = true;
      }
      table_ok = false;
    } else {
      connected = true;
      table_ok = Array.isArray(data);
    }
  } catch (e: unknown) {
    const msg = String((e as Error)?.message || e).toLowerCase();
    error = String((e as Error)?.message || e);
    connected = !msg.includes("failed to fetch") && !msg.includes("network");
    table_ok = false;
  }

  return NextResponse.json({ env_ok, connected, auth_ok, table_ok, error });
}
