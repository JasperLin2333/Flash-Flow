/**
 * useRequireEmailVerified Hook
 * Provides email verification checking and action blocking for unverified users
 */

import { useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";

interface UseRequireEmailVerifiedResult {
    /** Whether the current user has a verified email */
    isEmailVerified: boolean;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** 
     * Wraps an action to require email verification before execution.
     * Shows a toast warning if the user's email is not verified.
     */
    requireVerification: <T extends (...args: unknown[]) => unknown>(
        action: T,
        options?: { message?: string }
    ) => (...args: Parameters<T>) => ReturnType<T> | undefined;
    /**
     * Check if email is verified, show toast if not.
     * Returns true if verified, false otherwise.
     */
    checkVerification: (options?: { message?: string }) => boolean;
}

/**
 * Hook to check and require email verification before certain actions
 * 
 * @example
 * ```tsx
 * const { requireVerification, isEmailVerified } = useRequireEmailVerified();
 * 
 * // Wrap an action that requires verification
 * const handleCreateFlow = requireVerification(() => {
 *   // This only runs if email is verified
 *   createNewFlow();
 * });
 * 
 * // Or check manually
 * const { checkVerification } = useRequireEmailVerified();
 * const handleAction = () => {
 *   if (!checkVerification()) return;
 *   // Continue with action
 * };
 * ```
 */
export function useRequireEmailVerified(): UseRequireEmailVerifiedResult {
    const { user, isAuthenticated } = useAuthStore();

    const isEmailVerified = isAuthenticated && user?.email_confirmed === true;

    const checkVerification = useCallback((options?: { message?: string }): boolean => {
        if (!isAuthenticated) {
            toast({
                title: "请先登录",
                variant: "destructive",
            });
            return false;
        }

        if (!isEmailVerified) {
            toast({
                title: options?.message || "请先验证您的邮箱",
                description: "请查收验证邮件或重新发送验证链接",
                variant: "destructive",
            });
            return false;
        }

        return true;
    }, [isAuthenticated, isEmailVerified]);

    const requireVerification = useCallback(<T extends (...args: unknown[]) => unknown>(
        action: T,
        options?: { message?: string }
    ) => {
        return (...args: Parameters<T>): ReturnType<T> | undefined => {
            if (!checkVerification(options)) {
                return undefined;
            }
            return action(...args) as ReturnType<T>;
        };
    }, [checkVerification]);

    return {
        isEmailVerified,
        isAuthenticated,
        requireVerification,
        checkVerification,
    };
}
