/**
 * Authentication Store
 * Manages authentication state using Zustand
 */

import { create } from "zustand";
import { authService } from "@/services/authService";
import { useQuotaStore } from "@/store/quotaStore";
import { mapAuthError } from "@/utils/authErrorMapper";
import type { User, LoginCredentials, RegisterData } from "@/types/auth";
import { userProfileAPI } from "@/services/userProfileAPI";

interface AuthStore {
    // State
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // OTP State
    otpSentAt: number | null;   // Timestamp when OTP was sent (for countdown)
    registrationEmail: string | null;  // Email being used for registration
    resetEmail: string | null;  // Email being used for password reset
    isNewUser: boolean;  // Whether the email is for a new user (needs password setup)

    // Actions
    initialize: () => Promise<void>;
    login: (credentials: LoginCredentials) => Promise<boolean>;
    register: (data: RegisterData) => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    setUser: (user: User | null) => void;

    // OTP Actions
    sendSignUpOtp: (email: string) => Promise<boolean>;
    verifyOtpLogin: (token: string) => Promise<boolean>;  // For existing users
    verifySignUpOtp: (token: string, password: string) => Promise<boolean>;  // For new users
    sendPasswordResetOtp: (email: string) => Promise<boolean>;
    verifyResetOtp: (token: string, newPassword: string) => Promise<boolean>;
    resendVerification: () => Promise<boolean>;
    clearOtpState: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    // Initial State
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    // OTP State
    otpSentAt: null,
    registrationEmail: null,
    resetEmail: null,
    isNewUser: false,

    // Initialize auth state (call on app mount)
    initialize: async () => {
        set({ isLoading: true });

        try {
            const user = await authService.getCurrentUser();

            if (user) {
                set({ user, isAuthenticated: true, isLoading: false });
                await useQuotaStore.getState().fetchQuota(user.id);
            } else {
                set({ user: null, isAuthenticated: false, isLoading: false });
                useQuotaStore.getState().clearQuota();
            }

            // Listen to auth state changes
            authService.onAuthStateChange(async (user) => {
                if (user) {
                    set({ user, isAuthenticated: true });
                    await useQuotaStore.getState().fetchQuota(user.id);
                } else {
                    set({ user: null, isAuthenticated: false });
                    useQuotaStore.getState().clearQuota();
                }
            });
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    // Login user
    login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
            const { user, error } = await authService.signIn(credentials);

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            if (user) {
                set({ user, isAuthenticated: true, isLoading: false, error: null });
                return true;
            }

            set({ error: "登录失败", isLoading: false });
            return false;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "登录时发生错误";
            set({ error: errorMsg, isLoading: false });
            return false;
        } finally {
            // Double check to ensure loading is off
            if (get().isLoading) {
                set({ isLoading: false });
            }
        }
    },

    // Register new user (legacy - kept for backward compatibility)
    register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
            const { user, error } = await authService.signUp(data);

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            if (user) {
                set({ user, isAuthenticated: true, isLoading: false, error: null });
                return true;
            }

            set({ error: "注册失败", isLoading: false });
            return false;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "注册时发生错误";
            set({ error: errorMsg, isLoading: false });
            return false;
        } finally {
            // Double check to ensure loading is off
            if (get().isLoading) {
                set({ isLoading: false });
            }
        }
    },

    // Logout user
    logout: async () => {
        set({ isLoading: true });

        try {
            await authService.signOut();
            set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
                otpSentAt: null,
                registrationEmail: null,
                resetEmail: null,
            });
        } catch {
            // Force logout even if API call fails
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    // Clear error message
    clearError: () => set({ error: null }),

    // Set user (for external updates)
    setUser: (user: User | null) => {
        if (user) {
            set({ user, isAuthenticated: true });
        } else {
            set({ user: null, isAuthenticated: false });
        }
    },

    // ============ OTP Actions ============

    // Send OTP for sign up / login
    sendSignUpOtp: async (email: string) => {
        set({ isLoading: true, error: null });

        try {
            const { isNewUser, error } = await authService.sendSignUpOtp(email);

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            set({
                registrationEmail: email,
                otpSentAt: Date.now(),
                isNewUser,
                isLoading: false,
                error: null,
            });
            return true;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "发送验证码失败";
            set({ error: errorMsg, isLoading: false });
            return false;
        }
    },

    // Verify OTP and login directly (for existing users)
    verifyOtpLogin: async (token: string) => {
        const { registrationEmail } = get();
        if (!registrationEmail) {
            set({ error: "请先发送验证码" });
            return false;
        }

        set({ isLoading: true, error: null });

        try {
            const { user, error } = await authService.verifyOtpOnly(
                registrationEmail,
                token
            );

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            if (user) {
                set({
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                    registrationEmail: null,
                    otpSentAt: null,
                    isNewUser: false,
                });
                try {
                    const existing = await userProfileAPI.getProfile(user.id);
                    if (!existing) {
                        const defaultName = user.email.split("@")[0] || "";
                        await userProfileAPI.upsertProfile(user.id, {
                            display_name: defaultName,
                            avatar_kind: "emoji",
                            avatar_emoji: "👤",
                            avatar_url: null,
                        });
                    }
                } catch {}
                return true;
            }

            set({ error: "登录失败", isLoading: false });
            return false;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "验证失败";
            set({ error: errorMsg, isLoading: false });
            return false;
        }
    },

    // Verify OTP and complete sign up (for new users)
    verifySignUpOtp: async (token: string, password: string) => {
        const { registrationEmail } = get();
        if (!registrationEmail) {
            set({ error: "请先发送验证码" });
            return false;
        }

        set({ isLoading: true, error: null });

        try {
            const { user, error } = await authService.verifyOtpAndSignUp(
                registrationEmail,
                token,
                password
            );

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            if (user) {
                set({
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                    registrationEmail: null,
                    otpSentAt: null,
                    isNewUser: false,
                });
                return true;
            }

            set({ error: "注册失败", isLoading: false });
            return false;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "验证失败";
            set({ error: errorMsg, isLoading: false });
            return false;
        }
    },

    // Send OTP for password reset
    sendPasswordResetOtp: async (email: string) => {
        set({ isLoading: true, error: null });

        try {
            const { error } = await authService.sendPasswordResetOtp(email);

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            set({
                resetEmail: email,
                otpSentAt: Date.now(),
                isLoading: false,
                error: null,
            });
            return true;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "发送验证码失败";
            set({ error: errorMsg, isLoading: false });
            return false;
        }
    },

    // Verify OTP and reset password
    verifyResetOtp: async (token: string, newPassword: string) => {
        const { resetEmail } = get();
        if (!resetEmail) {
            set({ error: "请先发送验证码" });
            return false;
        }

        set({ isLoading: true, error: null });

        try {
            const { error } = await authService.verifyOtpAndResetPassword(
                resetEmail,
                token,
                newPassword
            );

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            set({
                isLoading: false,
                error: null,
                resetEmail: null,
                otpSentAt: null,
            });
            return true;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "重置密码失败";
            set({ error: errorMsg, isLoading: false });
            return false;
        }
    },

    // Resend verification email for unverified users
    resendVerification: async () => {
        const { user } = get();
        if (!user?.email) {
            set({ error: "未找到用户邮箱" });
            return false;
        }

        set({ isLoading: true, error: null });

        try {
            const { error } = await authService.resendVerificationEmail(user.email);

            if (error) {
                set({ error: mapAuthError(error.message), isLoading: false });
                return false;
            }

            set({ isLoading: false, error: null });
            return true;
        } catch (e) {
            const errorMsg = e instanceof Error ? mapAuthError(e.message) : "发送验证邮件失败";
            set({ error: errorMsg, isLoading: false });
            return false;
        }
    },

    // Clear OTP state (when user cancels or goes back)
    clearOtpState: () => set({
        otpSentAt: null,
        registrationEmail: null,
        resetEmail: null,
        error: null,
    }),
}));
