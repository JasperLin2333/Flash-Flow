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
                    className="bg-gray-900 hover:bg-gray-800 text-white text-sm px-4 py-2"
                >
                    登录 / 注册
                </Button>
                <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
            </>
        );
    }

    return (
        <div className="flex items-center gap-3">
            {/* Quota Display - Hover Dropdown */}
            <div className="relative group">
                <button
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer py-1"
                >
                    <span>我的算力</span>
                    <span className="block h-0.5 bg-gray-900 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200" />
                </button>

                {/* Dropdown Panel */}
                <div className="absolute top-full right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-5 min-w-[300px]">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">算力中心</h3>
                        <QuotaDisplay compact />
                        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 flex flex-col items-center gap-1.5">
                            <span>获取更多算力，请联系微信</span>
                            <span className="font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded select-all cursor-text hover:bg-gray-200 transition-colors">
                                JasperXHL
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

