/**
 * Email Verification Banner
 * Shows a banner for users who haven't verified their email
 */

"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { AlertTriangle, X, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
    const { user, isAuthenticated, resendVerification, isLoading } = useAuthStore();
    const [isDismissed, setIsDismissed] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    // Don't show if:
    // - User is not authenticated
    // - User email is confirmed
    // - Banner was dismissed
    if (!isAuthenticated || !user || user.email_confirmed || isDismissed) {
        return null;
    }

    const handleResend = async () => {
        const success = await resendVerification();
        if (success) {
            setEmailSent(true);
            // Reset after 5 seconds
            setTimeout(() => setEmailSent(false), 5000);
        }
    };

    return (
        <div className="bg-amber-50 border-b border-amber-200">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-amber-800">
                                请验证您的邮箱
                            </p>
                            <p className="text-sm text-amber-700 truncate">
                                我们已向 <span className="font-medium">{user.email}</span> 发送了验证邮件
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {emailSent ? (
                            <span className="text-sm text-green-600 flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                已发送
                            </span>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResend}
                                disabled={isLoading}
                                className="bg-white hover:bg-amber-100 border-amber-300 text-amber-800"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        发送中
                                    </>
                                ) : (
                                    "重新发送"
                                )}
                            </Button>
                        )}
                        <button
                            onClick={() => setIsDismissed(true)}
                            className="p-1 text-amber-600 hover:text-amber-800 transition-colors"
                            aria-label="关闭"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
