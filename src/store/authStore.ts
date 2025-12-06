/**
 * Authentication Store
 * Manages authentication state using Zustand
 */

import { create } from "zustand";
import { authService } from "@/services/authService";
import type { User, LoginCredentials, RegisterData } from "@/types/auth";

interface AuthStore {
    // State
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    initialize: () => Promise<void>;
    login: (credentials: LoginCredentials) => Promise<boolean>;
    register: (data: RegisterData) => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    // Initial State
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    // Initialize auth state (call on app mount)
    initialize: async () => {
        set({ isLoading: true });

        try {
            const user = await authService.getCurrentUser();

            if (user) {
                set({ user, isAuthenticated: true, isLoading: false });
            } else {
                set({ user: null, isAuthenticated: false, isLoading: false });
            }

            // Listen to auth state changes
            authService.onAuthStateChange((user) => {
                if (user) {
                    set({ user, isAuthenticated: true });
                } else {
                    set({ user: null, isAuthenticated: false });
                }
            });
        } catch (e) {
            console.error("[authStore] initialize error:", e);
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    // Login user
    login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
            const { user, error } = await authService.signIn(credentials);

            if (error) {
                set({ error: error.message, isLoading: false });
                return false;
            }

            if (user) {
                set({ user, isAuthenticated: true, isLoading: false, error: null });
                return true;
            }

            set({ error: "登录失败", isLoading: false });
            return false;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "登录时发生错误";
            set({ error: errorMsg, isLoading: false });
            return false;
        } finally {
            // Double check to ensure loading is off
            if (get().isLoading) {
                set({ isLoading: false });
            }
        }
    },

    // Register new user
    register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
            const { user, error } = await authService.signUp(data);

            if (error) {
                set({ error: error.message, isLoading: false });
                return false;
            }

            if (user) {
                set({ user, isAuthenticated: true, isLoading: false, error: null });
                return true;
            }

            set({ error: "注册失败", isLoading: false });
            return false;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "注册时发生错误";
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
            set({ user: null, isAuthenticated: false, isLoading: false, error: null });
        } catch (e) {
            console.error("[authStore] logout error:", e);
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
}));
