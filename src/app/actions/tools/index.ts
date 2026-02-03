"use server";

import { validateToolInputs, type ToolType } from "@/lib/tools/registry";
import type { ToolExecutionResult, ToolExecutionInput } from "./types";

import { TOOL_EXECUTORS } from "./toolExecutorMap";

// Auth & Quota imports
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { checkPointsWithClient, deductPointsWithClient } from "@/lib/quotaEdge";

// Re-export types for external use
export type { ToolExecutionResult, ToolExecutionInput };

// Helper to create Supabase client for Server Actions
async function createActionClient() {
    const cookieStore = await cookies();
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // The `set` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

/**
 * Execute a tool with the given inputs
 * 
 * This is the main server action that:
 * 1. Validates inputs against the tool's Zod schema
 * 2. Routes to the appropriate tool execution handler
 * 3. Returns structured results or errors
 * 
 * @param input - Tool type and inputs
 * @returns Execution result with success status and data/error
 */
export async function executeToolAction(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    const { toolType, inputs } = input;
    const normalizedInputs = toolType === "datetime"
        ? (() => {
            const base = (inputs && typeof inputs === "object") ? inputs : {};
            const operation = (base as Record<string, unknown>).operation;
            if (typeof operation !== "string" || operation.trim().length === 0) {
                return { ...base, operation: "now" };
            }
            return base;
        })()
        : inputs;

    // 1. Authentication & Quota Check (Pre-execution)
    const supabase = await createActionClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return {
            success: false,
            error: "请先登录以使用工具功能",
        };
    }

    // Check points balance
    const check = await checkPointsWithClient(supabase, user.id, "tool_usage", toolType);
    if (!check.allowed) {
        return {
            success: false,
            error: `积分不足，需要 ${check.required} 积分。当前余额: ${check.balance}`,
        };
    }

    // 2. Validate inputs against the tool's schema
    const validation = validateToolInputs(toolType as ToolType, normalizedInputs);

    if (!validation.success) {
        return {
            success: false,
            error: `Invalid inputs: ${validation.error}`,
        };
    }

    // 3. Route to the appropriate tool handler details using the executor map
    try {
        const executor = TOOL_EXECUTORS[toolType as ToolType];

        if (!executor) {
            // NOTE: Weather tool might fall here if not in the map, but it's hidden from UI
            return {
                success: false,
                error: `Unknown tool type: ${toolType}`,
            };
        }

        const result = await executor(validation.data);

        // 4. Deduct points (Post-execution)
        // Only deduct if execution was successful
        if (result.success) {
            await deductPointsWithClient(supabase, user.id, "tool_usage", toolType);
        }

        return result;

    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`Tool execution error (${toolType}):`, error);
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : "Tool execution failed",
        };
    }
}
