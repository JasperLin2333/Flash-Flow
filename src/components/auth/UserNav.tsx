/**
 * UserNav Component
 * Displays quota on hover only (no logout/email in header)
 */

"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { QuotaDisplay } from "@/components/auth/QuotaDisplay";
import { AuthDialog } from "@/components/auth/AuthDialog";

export function UserNav() {
    const { user, isAuthenticated } = useAuthStore();
    const [showAuthDialog, setShowAuthDialog] = useState(false);

    // ✅ BUG FIX #1: Check if user needs to confirm email
    // DEFENSIVE: Early return pattern for unauthenticated state
    if (!isAuthenticated || !user) {
        return (
            <>
                <Button
                    onClick={() => setShowAuthDialog(true)}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm px-4 py-2"
                >
                    登录 / 注册
                </Button>
                <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
            </>
        );
    }

    // 🧹 CODE CLEANUP: Extract email confirmation check for clarity
    const isEmailUnconfirmed = !user.email_confirmed;

    return (
        <div className="flex items-center gap-3">
            {/* ✅ BUG FIX #1: Email Confirmation Warning Banner */}
            {isEmailUnconfirmed && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <svg
                        className="h-4 w-4 text-amber-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <span className="text-sm text-amber-800">
                        请先到邮箱确认注册
                    </span>
                </div>
            )}

            {/* Quota Display - Hover Dropdown */}
            <div className="relative group">
                <button
                    className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer py-1"
                >
                    <span>查看配额（套餐）</span>
                    <span className="block h-0.5 bg-zinc-900 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200" />
                </button>

                {/* Dropdown Panel */}
                <div className="absolute top-full right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="bg-white rounded-lg shadow-xl border border-zinc-200 p-4 min-w-[280px]">
                        <h3 className="text-sm font-semibold text-zinc-900 mb-3">使用详情</h3>
                        <QuotaDisplay compact className="flex-col gap-2" />
                        <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 text-center">
                            如需提升额度，请联系QQ：3435164639
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

