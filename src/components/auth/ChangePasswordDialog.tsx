/**
 * ChangePasswordDialog Component
 * Dialog for changing user password with original password verification
 */

"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

// ============ 配置常量 ============
const FORM_STYLES = {
    FIELD_SPACING: "space-y-2",
    FORM_SPACING: "space-y-4",
    INPUT_CLASSES: "bg-white border-gray-200",
} as const;

const UI_TEXT = {
    title: "修改密码",
    description: "请先输入原密码进行验证",
    oldPasswordLabel: "原密码",
    newPasswordLabel: "新密码",
    confirmPasswordLabel: "确认新密码",
    submitButton: "确认修改",
    cancelButton: "取消",
    submitting: "修改中...",
    successMessage: "密码修改成功！",
    errorPrefix: "修改失败：",
} as const;

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const user = useAuthStore((s) => s.user);

    // Clear form when dialog opens/closes
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setError(null);
            setSuccess(false);
        }
        onOpenChange(open);
    };

    // Handle password change submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        // Validate inputs
        if (!oldPassword || !newPassword || !confirmPassword) {
            setError("请填写所有字段");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("新密码两次输入不一致");
            return;
        }

        if (newPassword.length < 6) {
            setError("新密码长度至少为6位");
            return;
        }

        if (!user?.email) {
            setError("无法获取用户信息，请重新登录");
            return;
        }

        setIsLoading(true);

        try {
            // Step 1: Verify old password by attempting to sign in
            const { error: signInError } = await authService.signIn({
                email: user.email,
                password: oldPassword,
            });

            if (signInError) {
                setError("原密码不正确");
                setIsLoading(false);
                return;
            }

            // Step 2: Update password
            const { error: updateError } = await authService.updatePassword(newPassword);

            if (updateError) {
                setError(updateError.message || "密码更新失败");
                setIsLoading(false);
                return;
            }

            // Success!
            setSuccess(true);
            setIsLoading(false);

            // Auto-close after 1.5 seconds
            setTimeout(() => {
                handleOpenChange(false);
            }, 1500);
        } catch (err) {
            console.error("Change password error:", err);
            setError(err instanceof Error ? err.message : "未知错误");
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-white border-gray-200">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-gray-900">
                        {UI_TEXT.title}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600">
                        {UI_TEXT.description}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className={FORM_STYLES.FORM_SPACING}>
                    <div className={FORM_STYLES.FIELD_SPACING}>
                        <Label htmlFor="old-password">{UI_TEXT.oldPasswordLabel}</Label>
                        <PasswordInput
                            id="old-password"
                            placeholder="••••••••"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            disabled={isLoading || success}
                            required
                            className={FORM_STYLES.INPUT_CLASSES}
                        />
                    </div>

                    <div className={FORM_STYLES.FIELD_SPACING}>
                        <Label htmlFor="new-password">{UI_TEXT.newPasswordLabel}</Label>
                        <PasswordInput
                            id="new-password"
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={isLoading || success}
                            required
                            minLength={6}
                            className={FORM_STYLES.INPUT_CLASSES}
                        />
                        <p className="text-xs text-gray-500">密码长度至少 6 位</p>
                    </div>

                    <div className={FORM_STYLES.FIELD_SPACING}>
                        <Label htmlFor="confirm-new-password">{UI_TEXT.confirmPasswordLabel}</Label>
                        <PasswordInput
                            id="confirm-new-password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading || success}
                            required
                            minLength={6}
                            className={FORM_STYLES.INPUT_CLASSES}
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{UI_TEXT.successMessage}</span>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleOpenChange(false)}
                            disabled={isLoading}
                            className="flex-1 text-gray-500 hover:text-gray-900"
                        >
                            {UI_TEXT.cancelButton}
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                            disabled={isLoading || success}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {UI_TEXT.submitting}
                                </>
                            ) : (
                                UI_TEXT.submitButton
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
