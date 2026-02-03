/**
 * ProtectedRoute Component
 * Requires authentication to access wrapped content
 */

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { AuthDialog } from "./AuthDialog";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, initialize } = useAuthStore();
    const [showAuthDialog, setShowAuthDialog] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);

    useEffect(() => {
        if (!hasInitialized) {
            initialize().then(() => setHasInitialized(true));
        }
    }, [initialize, hasInitialized]);

    useEffect(() => {
        if (hasInitialized && !isAuthenticated && !isLoading) {
            setShowAuthDialog(true);
        }
    }, [hasInitialized, isAuthenticated, isLoading]);

    // Still initializing
    if (!hasInitialized || isLoading) {
        return (
            fallback || (
                <div className="flex items-center justify-center h-screen w-full bg-white">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <p className="text-sm text-gray-600">加载中…</p>
                    </div>
                </div>
            )
        );
    }

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <>
                <div className="flex items-center justify-center h-screen w-full bg-gray-50">
                    <div className="text-center space-y-4 p-8">
                        <h2 className="text-2xl font-semibold text-gray-900">需要登录</h2>
                        <p className="text-gray-600">请登录或注册以继续使用 Flash Flow</p>
                    </div>
                </div>
                <AuthDialog
                    open={showAuthDialog}
                    onOpenChange={(open) => {
                        setShowAuthDialog(open);
                        // If user closes the dialog without logging in, keep showing it
                        if (!open && !isAuthenticated) {
                            setTimeout(() => setShowAuthDialog(true), 500);
                        }
                    }}
                />
            </>
        );
    }

    // Authenticated - render children
    return <>{children}</>;
}
