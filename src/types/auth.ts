/**
 * Authentication and User Quota Types
 */

import type { User as SupabaseUser } from "@supabase/supabase-js";

/**
 * Application User Type
 * Extended with email confirmation tracking
 */
export interface User {
    id: string;
    email: string;
    email_confirmed: boolean;  // 🧹 CODE CLEANUP: Added for email verification UX
    email_confirmed_at?: string | null;  // 🧹 DEFENSIVE: Nullable for unconfirmed users
    created_at: string;
}


/**
 * User Quota Information
 */
export interface UserQuota {
    id: string;
    user_id: string;
    llm_executions_used: number;
    flow_generations_used: number;
    app_usages_used: number;
    image_gen_executions_used: number;
    llm_executions_limit: number;
    flow_generations_limit: number;
    app_usages_limit: number;
    image_gen_executions_limit: number;
    points_balance: number;
    points_used: number;
    created_at: string;
    updated_at: string;
}

/**
 * Quota Type Enum
 */
export type QuotaType = "llm_executions" | "flow_generations" | "app_usages" | "image_gen_executions";

/**
 * Auth State
 */
export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

/**
 * Login Credentials
 */
export interface LoginCredentials {
    email: string;
    password: string;
}

/**
 * Registration Data
 */
export interface RegisterData {
    email: string;
    password: string;
}

/**
 * Quota Check Result
 */
export interface QuotaCheckResult {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
}

export type PointsActionType =
    | "llm"
    | "flow_generation"
    | "app_usage"
    | "image_generation"
    | "rag_search"
    | "tool_usage";

export interface PointsCheckResult {
    allowed: boolean;
    required: number;
    balance: number;
    remaining: number;
}

export interface PointsLedgerEntry {
    id: string;
    user_id: string;
    action_type: PointsActionType;
    item_key: string | null;
    title: string;
    points: number;
    balance_after: number;
    created_at: string;
}

/**
 * Convert Supabase User to Application User
 * 🧹 REFACTORED: Now includes email confirmation status
 */
export function toAppUser(supabaseUser: SupabaseUser): User {
    return {
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        email_confirmed: !!supabaseUser.email_confirmed_at,  // ✅ BUG FIX: Track confirmation status
        email_confirmed_at: supabaseUser.email_confirmed_at || null,  // 🧹 DEFENSIVE: Handle null case
        created_at: supabaseUser.created_at,
    };
}
