/**
 * AuthDialog Component
 * Unified login/register dialog with tab switching
 */

"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";

// ============ 配置常量 ============
const FORM_STYLES = {
    FIELD_SPACING: "space-y-2",
    FORM_SPACING: "space-y-4",
    INPUT_CLASSES: "bg-white border-zinc-200",
} as const;

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: "login" | "register";
}

export function AuthDialog({ open, onOpenChange, defaultTab = "login" }: AuthDialogProps) {
    const [tab, setTab] = useState<string>(defaultTab);
    const { clearError } = useAuthStore();

    // Clear error when dialog opens/closes or tab changes
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            clearError();
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-white border-zinc-200">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-zinc-900">
                        {tab === "login" ? "登录" : "注册"}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-600">
                        {tab === "login"
                            ? "登录您的账户以继续使用 Flash Flow"
                            : "创建新账户开始使用 Flash Flow"}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={(v) => { setTab(v); clearError(); }} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="login">登录</TabsTrigger>
                        <TabsTrigger value="register">注册</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <LoginForm onSuccess={() => handleOpenChange(false)} />
                    </TabsContent>

                    <TabsContent value="register">
                        <RegisterForm onSuccess={() => handleOpenChange(false)} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login, isLoading, error } = useAuthStore();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        const success = await login({ email, password });
        if (success) {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleLogin} className={FORM_STYLES.FORM_SPACING}>
            <div className={FORM_STYLES.FIELD_SPACING}>
                <Label htmlFor="login-email">邮箱</Label>
                <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className={FORM_STYLES.INPUT_CLASSES}
                />
            </div>

            <div className={FORM_STYLES.FIELD_SPACING}>
                <Label htmlFor="login-password">密码</Label>
                <PasswordInput
                    id="login-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className={FORM_STYLES.INPUT_CLASSES}
                />
            </div>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    {error}
                </div>
            )}

            <Button
                type="submit"
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                    </>
                ) : (
                    "登录"
                )}
            </Button>
        </form>
    );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const { register, isLoading, error } = useAuthStore();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || !confirmPassword) return;
        if (password !== confirmPassword) return;

        const success = await register({ email, password });
        if (success) {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleRegister} className={FORM_STYLES.FORM_SPACING}>
            <div className={FORM_STYLES.FIELD_SPACING}>
                <Label htmlFor="register-email">邮箱</Label>
                <Input
                    id="register-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className={FORM_STYLES.INPUT_CLASSES}
                />
            </div>

            <div className={FORM_STYLES.FIELD_SPACING}>
                <Label htmlFor="register-password">密码</Label>
                <PasswordInput
                    id="register-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    minLength={6}
                    className={FORM_STYLES.INPUT_CLASSES}
                />
            </div>

            <div className={FORM_STYLES.FIELD_SPACING}>
                <Label htmlFor="confirm-password">确认密码</Label>
                <PasswordInput
                    id="confirm-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    minLength={6}
                    className={FORM_STYLES.INPUT_CLASSES}
                />
            </div>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    {error}
                </div>
            )}

            {password && confirmPassword && password !== confirmPassword && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    密码不匹配
                </div>
            )}

            <Button
                type="submit"
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white"
                disabled={isLoading || password !== confirmPassword}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        注册中...
                    </>
                ) : (
                    "注册"
                )}
            </Button>
        </form>
    );
}
