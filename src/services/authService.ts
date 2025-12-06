/**
 * Authentication Service
 * Handles user authentication using Supabase Auth
 */

import { supabase } from "@/lib/supabase";
import type { User, LoginCredentials, RegisterData } from "@/types/auth";
import { toAppUser } from "@/types/auth";

export const authService = {
    /**
     * Helper to add timeout to promises
     */
    async withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000, errorMsg: string = "请求超时"): Promise<T> {
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
        });

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timer!);
            return result;
        } catch (error) {
            clearTimeout(timer!);
            throw error;
        }
    },

    /**
     * Sign up a new user
     */
    async signUp({ email, password }: RegisterData): Promise<{ user: User | null; error: Error | null }> {
        try {
            const { data, error } = await this.withTimeout(
                supabase.auth.signUp({
                    email,
                    password,
                }),
                15000,
                "注册请求超时，请检查网络连接"
            );

            if (error) {
                return { user: null, error };
            }

            if (!data.user) {
                return { user: null, error: new Error("注册失败,请稍后重试") };
            }

            return { user: toAppUser(data.user), error: null };
        } catch (e) {
            console.error("[authService] signUp error:", e);
            return { user: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Sign in an existing user
     */
    async signIn({ email, password }: LoginCredentials): Promise<{ user: User | null; error: Error | null }> {
        try {
            const { data, error } = await this.withTimeout(
                supabase.auth.signInWithPassword({
                    email,
                    password,
                }),
                15000,
                "登录请求超时，请检查网络连接"
            );

            if (error) {
                return { user: null, error };
            }

            if (!data.user) {
                return { user: null, error: new Error("登录失败,请检查邮箱和密码") };
            }

            return { user: toAppUser(data.user), error: null };
        } catch (e) {
            console.error("[authService] signIn error:", e);
            return { user: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Sign out the current user
     */
    async signOut(): Promise<{ error: Error | null }> {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                return { error };
            }
            return { error: null };
        } catch (e) {
            console.error("[authService] signOut error:", e);
            return { error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Get the current authenticated user
     */
    async getCurrentUser(): Promise<User | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user ? toAppUser(user) : null;
        } catch (e) {
            console.error("[authService] getCurrentUser error:", e);
            return null;
        }
    },

    /**
     * Get the current session
     */
    async getSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            return session;
        } catch (e) {
            console.error("[authService] getSession error:", e);
            return null;
        }
    },

    /**
     * Listen to auth state changes
     */
    onAuthStateChange(callback: (user: User | null) => void) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                callback(toAppUser(session.user));
            } else {
                callback(null);
            }
        });

        return subscription;
    },

    /**
     * Reset password (send reset email)
     */
    async resetPassword(email: string): Promise<{ error: Error | null }> {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });

            if (error) {
                return { error };
            }

            return { error: null };
        } catch (e) {
            console.error("[authService] resetPassword error:", e);
            return { error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Update password (when user is logged in)
     */
    async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                return { error };
            }

            return { error: null };
        } catch (e) {
            console.error("[authService] updatePassword error:", e);
            return { error: e instanceof Error ? e : new Error(String(e)) };
        }
    },
};
