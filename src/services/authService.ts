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

    // ============ OTP 相关方法 ============

    /**
     * Send OTP for sign up / login
     * Returns isNewUser to indicate if user needs to set password after verification
     */
    async sendSignUpOtp(email: string): Promise<{ isNewUser: boolean; error: Error | null }> {
        try {
            // First try without creating user to check if user exists
            const { error } = await this.withTimeout(
                supabase.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: false,
                    },
                }),
                15000,
                "发送验证码超时，请检查网络连接"
            );

            // If no error, user exists - they can login directly after OTP
            if (!error) {
                return { isNewUser: false, error: null };
            }

            // Check if error is because user doesn't exist
            if (error.message?.includes("Signups not allowed") ||
                error.message?.includes("User not found") ||
                error.message?.includes("otp_disabled")) {
                // User doesn't exist, create them with OTP
                const { error: createError } = await this.withTimeout(
                    supabase.auth.signInWithOtp({
                        email,
                        options: {
                            shouldCreateUser: true,
                        },
                    }),
                    15000,
                    "发送验证码超时，请检查网络连接"
                );

                if (createError) {
                    return { isNewUser: false, error: createError };
                }

                return { isNewUser: true, error: null };
            }

            // Other errors
            return { isNewUser: false, error };
        } catch (e) {
            console.error("[authService] sendSignUpOtp error:", e);
            return { isNewUser: false, error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Verify OTP only (for existing users logging in)
     */
    async verifyOtpOnly(
        email: string,
        token: string
    ): Promise<{ user: User | null; error: Error | null }> {
        try {
            const { data, error: verifyError } = await this.withTimeout(
                supabase.auth.verifyOtp({
                    email,
                    token,
                    type: "email",
                }),
                15000,
                "验证码验证超时，请重试"
            );

            if (verifyError) {
                return { user: null, error: verifyError };
            }

            if (!data.user) {
                return { user: null, error: new Error("验证失败，请重试") };
            }

            return { user: toAppUser(data.user), error: null };
        } catch (e) {
            console.error("[authService] verifyOtpOnly error:", e);
            return { user: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Verify OTP and complete sign up with password
     * This verifies the OTP token and then sets the user's password
     */
    async verifyOtpAndSignUp(
        email: string,
        token: string,
        password: string
    ): Promise<{ user: User | null; error: Error | null }> {
        try {
            // First verify the OTP
            const { data, error: verifyError } = await this.withTimeout(
                supabase.auth.verifyOtp({
                    email,
                    token,
                    type: "email",
                }),
                15000,
                "验证码验证超时，请重试"
            );

            if (verifyError) {
                return { user: null, error: verifyError };
            }

            if (!data.user) {
                return { user: null, error: new Error("验证失败，请重试") };
            }

            // Now set the password for the user
            const { error: updateError } = await supabase.auth.updateUser({
                password,
            });

            if (updateError) {
                return { user: null, error: updateError };
            }

            return { user: toAppUser(data.user), error: null };
        } catch (e) {
            console.error("[authService] verifyOtpAndSignUp error:", e);
            return { user: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Send OTP for password reset
     */
    async sendPasswordResetOtp(email: string): Promise<{ error: Error | null }> {
        try {
            const { error } = await this.withTimeout(
                supabase.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: false,
                    },
                }),
                15000,
                "发送重置验证码超时，请检查网络连接"
            );

            if (error) {
                // Check if user doesn't exist
                if (error.message?.includes("User not found") || error.message?.includes("Signups not allowed")) {
                    return { error: new Error("该邮箱未注册") };
                }
                return { error };
            }

            return { error: null };
        } catch (e) {
            console.error("[authService] sendPasswordResetOtp error:", e);
            return { error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Verify OTP and reset password
     */
    async verifyOtpAndResetPassword(
        email: string,
        token: string,
        newPassword: string
    ): Promise<{ error: Error | null }> {
        try {
            // Verify the OTP first
            const { error: verifyError } = await this.withTimeout(
                supabase.auth.verifyOtp({
                    email,
                    token,
                    type: "email",
                }),
                15000,
                "验证码验证超时，请重试"
            );

            if (verifyError) {
                return { error: verifyError };
            }

            // Update the password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                return { error: updateError };
            }

            // Sign out after password reset so user can login with new password
            await supabase.auth.signOut();

            return { error: null };
        } catch (e) {
            console.error("[authService] verifyOtpAndResetPassword error:", e);
            return { error: e instanceof Error ? e : new Error(String(e)) };
        }
    },

    /**
     * Resend verification email for unverified users
     */
    async resendVerificationEmail(email: string): Promise<{ error: Error | null }> {
        try {
            const { error } = await this.withTimeout(
                supabase.auth.resend({
                    type: "signup",
                    email,
                }),
                15000,
                "发送验证邮件超时，请检查网络连接"
            );

            if (error) {
                return { error };
            }

            return { error: null };
        } catch (e) {
            console.error("[authService] resendVerificationEmail error:", e);
            return { error: e instanceof Error ? e : new Error(String(e)) };
        }
    },
};
