/**
 * Edge Runtime Authentication Utility
 * 
 * Provides authentication helpers for Edge Runtime API routes.
 * Uses @supabase/ssr for cookie-based session handling.
 */

import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Create a Supabase client for Edge Runtime API routes
 * Reads cookies from the request headers
 */
export function createEdgeClient(request: Request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        console.error("[authEdge] Missing Supabase environment variables!", { url: !!url, anonKey: !!anonKey });
        throw new Error("Missing Supabase environment variables");
    }

    return createServerClient<Database>(url, anonKey, {
        cookies: {
            getAll() {
                const cookieHeader = request.headers.get("cookie") || "";
                const cookies: { name: string; value: string }[] = [];

                if (!cookieHeader) {
                    console.warn("[authEdge] No cookie header found in request. User may not be logged in or cookies not sent.");
                }

                cookieHeader.split(";").forEach((cookie) => {
                    const [name, ...rest] = cookie.trim().split("=");
                    if (name) {
                        cookies.push({
                            name,
                            value: rest.join("="),
                        });
                    }
                });

                if (cookies.length > 0) {
                    // console.log(`[authEdge] Parsed ${cookies.length} cookies`);
                }

                return cookies;
            },
            setAll() {
                // Not needed for read-only API routes
            },
        },
    });
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(request: Request) {
    try {
        const supabase = createEdgeClient(request);
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            console.error("[authEdge] getUser error:", error.message);
            return null;
        }

        if (!user) {
            console.warn("[authEdge] No user found in session (getUser returned null)");
            return null;
        }

        return user;
    } catch (e) {
        console.error("[authEdge] getAuthenticatedUser exception:", e);
        return null;
    }
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(message = "请先登录") {
    return new Response(
        JSON.stringify({ error: message }),
        {
            status: 401,
            headers: { "Content-Type": "application/json" },
        }
    );
}
