/**
 * AuthDialog Component
 * Unified login/register dialog with OTP verification and forgot password
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { Loader2, ArrowLeft, Mail, KeyRound, CheckCircle2 } from "lucide-react";

// ============ 配置常量 ============
const FORM_STYLES = {
    FIELD_SPACING: "space-y-2",
    FORM_SPACING: "space-y-4",
    INPUT_CLASSES: "bg-white border-gray-200",
} as const;

const OTP_RESEND_INTERVAL = 60; // seconds

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: "login" | "register";
}

export function AuthDialog({ open, onOpenChange, defaultTab = "login" }: AuthDialogProps) {
    const [tab, setTab] = useState<string>(defaultTab);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const { clearError, clearOtpState } = useAuthStore();

    // Clear state when dialog opens/closes
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            clearError();
            clearOtpState();
            setShowForgotPassword(false);
        }
        onOpenChange(open);
    };

    const handleTabChange = (value: string) => {
        setTab(value);
        clearError();
        clearOtpState();
        setShowForgotPassword(false);
    };

    const getTitle = () => {
        if (showForgotPassword) return "重置密码";
        return tab === "login" ? "登录" : "注册";
    };

    const getDescription = () => {
        if (showForgotPassword) return "输入您的邮箱，我们将发送验证码帮您重置密码";
        return tab === "login"
            ? "登录您的账户以继续使用 Flash Flow"
            : "创建新账户开始使用 Flash Flow";
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-white border-gray-200">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-gray-900">
                        {getTitle()}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600">
                        {getDescription()}
                    </DialogDescription>
                </DialogHeader>

                {showForgotPassword ? (
                    <ForgotPasswordForm
                        onBack={() => {
                            setShowForgotPassword(false);
                            clearError();
                            clearOtpState();
                        }}
                        onSuccess={() => {
                            setShowForgotPassword(false);
                            clearOtpState();
                        }}
                    />
                ) : (
                    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="login">登录</TabsTrigger>
                            <TabsTrigger value="register">注册</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <LoginForm
                                onSuccess={() => handleOpenChange(false)}
                                onForgotPassword={() => setShowForgotPassword(true)}
                            />
                        </TabsContent>

                        <TabsContent value="register">
                            <RegisterForm onSuccess={() => handleOpenChange(false)} />
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ============ 登录表单 ============
function LoginForm({ onSuccess, onForgotPassword }: { onSuccess: () => void; onForgotPassword: () => void }) {
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
                <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">密码</Label>
                    <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        忘记密码？
                    </button>
                </div>
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

            <ErrorMessage error={error} />

            <Button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
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

// ============ 注册表单（多步骤） ============
type RegisterStep = "email" | "otp" | "password";

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
    const [step, setStep] = useState<RegisterStep>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const {
        sendSignUpOtp,
        verifySignUpOtp,
        verifyOtpLogin,
        isLoading,
        error,
        otpSentAt,
        isNewUser,
        clearError,
        clearOtpState,
    } = useAuthStore();

    // Reset form when unmounting
    useEffect(() => {
        return () => {
            clearOtpState();
        };
    }, [clearOtpState]);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        const success = await sendSignUpOtp(email);
        if (success) {
            setStep("otp");
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp || otp.length !== 8) return;

        // If existing user, verify OTP and login directly
        if (!isNewUser) {
            const success = await verifyOtpLogin(otp);
            if (success) {
                onSuccess();
            }
            return;
        }

        // New user: move to password step
        setStep("password");
        clearError();
    };

    const handleCompleteRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || password !== confirmPassword) return;

        const success = await verifySignUpOtp(otp, password);
        if (success) {
            onSuccess();
        }
    };

    const handleBack = () => {
        clearError();
        if (step === "otp") {
            setStep("email");
            setOtp("");
        } else if (step === "password") {
            setStep("otp");
            setPassword("");
            setConfirmPassword("");
        }
    };

    // Dynamic steps based on whether user is new or existing
    const steps = isNewUser
        ? [
            { key: "email", icon: Mail, label: "邮箱" },
            { key: "otp", icon: KeyRound, label: "验证" },
            { key: "password", icon: CheckCircle2, label: "密码" },
        ]
        : [
            { key: "email", icon: Mail, label: "邮箱" },
            { key: "otp", icon: KeyRound, label: "验证" },
        ];

    return (
        <div className={FORM_STYLES.FORM_SPACING}>
            {/* Step Indicator */}
            <StepIndicator
                steps={steps}
                currentStep={step}
            />

            {/* Step 1: Email Input */}
            {step === "email" && (
                <form onSubmit={handleSendOtp} className={FORM_STYLES.FORM_SPACING}>
                    <div className={FORM_STYLES.FIELD_SPACING}>
                        <Label htmlFor="register-email">邮箱地址</Label>
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

                    <ErrorMessage error={error} />

                    <Button
                        type="submit"
                        className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                        disabled={isLoading || !email}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                发送中...
                            </>
                        ) : (
                            "发送验证码"
                        )}
                    </Button>
                </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className={FORM_STYLES.FORM_SPACING}>
                    <div className={FORM_STYLES.FIELD_SPACING}>
                        <Label htmlFor="register-otp">验证码</Label>
                        <p className="text-sm text-gray-500 mb-2">
                            已发送 8 位验证码到 <span className="font-medium text-gray-700">{email}</span>
                        </p>
                        <Input
                            id="register-otp"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={8}
                            placeholder="00000000"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            disabled={isLoading}
                            required
                            className={`${FORM_STYLES.INPUT_CLASSES} text-center text-xl tracking-widest font-mono`}
                        />
                    </div>

                    <ResendOtpButton
                        otpSentAt={otpSentAt}
                        onResend={() => sendSignUpOtp(email)}
                        isLoading={isLoading}
                    />

                    <ErrorMessage error={error} />

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            返回
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                            disabled={isLoading || otp.length !== 8}
                        >
                            下一步
                        </Button>
                    </div>
                </form>
            )}

            {/* Step 3: Password Setup */}
            {step === "password" && (
                <form onSubmit={handleCompleteRegistration} className={FORM_STYLES.FORM_SPACING}>
                    <div className={FORM_STYLES.FIELD_SPACING}>
                        <Label htmlFor="register-password">设置密码</Label>
                        <PasswordInput
                            id="register-password"
                            placeholder="至少 6 位字符"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            required
                            minLength={6}
                            className={FORM_STYLES.INPUT_CLASSES}
                        />
                    </div>

                    <div className={FORM_STYLES.FIELD_SPACING}>
                        <Label htmlFor="register-confirm-password">确认密码</Label>
                        <PasswordInput
                            id="register-confirm-password"
                            placeholder="再次输入密码"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading}
                            required
                            minLength={6}
                            className={FORM_STYLES.INPUT_CLASSES}
                        />
                    </div>

                    <ErrorMessage error={error} />

                    {password && confirmPassword && password !== confirmPassword && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                            密码不匹配
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            返回
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                            disabled={isLoading || !password || password !== confirmPassword}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    注册中...
                                </>
                            ) : (
                                "完成注册"
                            )}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}

// ============ 忘记密码表单（多步骤） ============
type ResetStep = "email" | "otp" | "newPassword" | "success";

function ForgotPasswordForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
    const [step, setStep] = useState<ResetStep>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const {
        sendPasswordResetOtp,
        verifyResetOtp,
        isLoading,
        error,
        otpSentAt,
        clearError,
        clearOtpState,
    } = useAuthStore();

    useEffect(() => {
        return () => {
            clearOtpState();
        };
    }, [clearOtpState]);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        const success = await sendPasswordResetOtp(email);
        if (success) {
            setStep("otp");
        }
    };

    const handleVerifyAndReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp || otp.length !== 8) return;

        setStep("newPassword");
        clearError();
    };

    const handleCompleteReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword || newPassword !== confirmPassword) return;

        const success = await verifyResetOtp(otp, newPassword);
        if (success) {
            setStep("success");
        }
    };

    const handleStepBack = () => {
        clearError();
        if (step === "otp") {
            setStep("email");
            setOtp("");
        } else if (step === "newPassword") {
            setStep("otp");
            setNewPassword("");
            setConfirmPassword("");
        }
    };

    return (
        <div className={FORM_STYLES.FORM_SPACING}>
            {/* Success State */}
            {step === "success" ? (
                <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">密码重置成功</h3>
                    <p className="text-sm text-gray-500 mb-4">您现在可以使用新密码登录了</p>
                    <Button
                        onClick={onSuccess}
                        className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                    >
                        返回登录
                    </Button>
                </div>
            ) : (
                <>
                    {/* Step Indicator */}
                    <StepIndicator
                        steps={[
                            { key: "email", icon: Mail, label: "邮箱" },
                            { key: "otp", icon: KeyRound, label: "验证" },
                            { key: "newPassword", icon: CheckCircle2, label: "新密码" },
                        ]}
                        currentStep={step}
                    />

                    {/* Step 1: Email Input */}
                    {step === "email" && (
                        <form onSubmit={handleSendOtp} className={FORM_STYLES.FORM_SPACING}>
                            <div className={FORM_STYLES.FIELD_SPACING}>
                                <Label htmlFor="reset-email">注册邮箱</Label>
                                <Input
                                    id="reset-email"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    required
                                    className={FORM_STYLES.INPUT_CLASSES}
                                />
                            </div>

                            <ErrorMessage error={error} />

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onBack}
                                    disabled={isLoading}
                                    className="flex-1"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    返回
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                                    disabled={isLoading || !email}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            发送中...
                                        </>
                                    ) : (
                                        "发送验证码"
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Step 2: OTP Verification */}
                    {step === "otp" && (
                        <form onSubmit={handleVerifyAndReset} className={FORM_STYLES.FORM_SPACING}>
                            <div className={FORM_STYLES.FIELD_SPACING}>
                                <Label htmlFor="reset-otp">验证码</Label>
                                <p className="text-sm text-gray-500 mb-2">
                                    已发送 8 位验证码到 <span className="font-medium text-gray-700">{email}</span>
                                </p>
                                <Input
                                    id="reset-otp"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={8}
                                    placeholder="00000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                    disabled={isLoading}
                                    required
                                    className={`${FORM_STYLES.INPUT_CLASSES} text-center text-xl tracking-widest font-mono`}
                                />
                            </div>

                            <ResendOtpButton
                                otpSentAt={otpSentAt}
                                onResend={() => sendPasswordResetOtp(email)}
                                isLoading={isLoading}
                            />

                            <ErrorMessage error={error} />

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleStepBack}
                                    disabled={isLoading}
                                    className="flex-1"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    返回
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                                    disabled={isLoading || otp.length !== 8}
                                >
                                    下一步
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Step 3: New Password */}
                    {step === "newPassword" && (
                        <form onSubmit={handleCompleteReset} className={FORM_STYLES.FORM_SPACING}>
                            <div className={FORM_STYLES.FIELD_SPACING}>
                                <Label htmlFor="new-password">新密码</Label>
                                <PasswordInput
                                    id="new-password"
                                    placeholder="至少 6 位字符"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={isLoading}
                                    required
                                    minLength={6}
                                    className={FORM_STYLES.INPUT_CLASSES}
                                />
                            </div>

                            <div className={FORM_STYLES.FIELD_SPACING}>
                                <Label htmlFor="confirm-new-password">确认新密码</Label>
                                <PasswordInput
                                    id="confirm-new-password"
                                    placeholder="再次输入新密码"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={isLoading}
                                    required
                                    minLength={6}
                                    className={FORM_STYLES.INPUT_CLASSES}
                                />
                            </div>

                            <ErrorMessage error={error} />

                            {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                    密码不匹配
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleStepBack}
                                    disabled={isLoading}
                                    className="flex-1"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    返回
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                                    disabled={isLoading || !newPassword || newPassword !== confirmPassword}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            重置中...
                                        </>
                                    ) : (
                                        "重置密码"
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </>
            )}
        </div>
    );
}

// ============ 共享组件 ============

function ErrorMessage({ error }: { error: string | null }) {
    if (!error) return null;
    return (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            {error}
        </div>
    );
}

interface StepIndicatorProps {
    steps: Array<{ key: string; icon: React.ComponentType<{ className?: string }>; label: string }>;
    currentStep: string;
}

function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
        <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;

                return (
                    <div key={step.key} className="flex items-center">
                        <div
                            className={`
                                flex items-center justify-center w-8 h-8 rounded-full transition-colors
                                ${isActive ? 'bg-gray-900 text-white' : ''}
                                ${isCompleted ? 'bg-green-500 text-white' : ''}
                                ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-400' : ''}
                            `}
                        >
                            <Icon className="w-4 h-4" />
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={`w-8 h-0.5 mx-1 transition-colors ${isCompleted ? 'bg-green-500' : 'bg-gray-200'
                                    }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

interface ResendOtpButtonProps {
    otpSentAt: number | null;
    onResend: () => Promise<boolean>;
    isLoading: boolean;
}

function ResendOtpButton({ otpSentAt, onResend, isLoading }: ResendOtpButtonProps) {
    const [countdown, setCountdown] = useState(0);

    const updateCountdown = useCallback(() => {
        if (!otpSentAt) {
            setCountdown(0);
            return;
        }
        const elapsed = Math.floor((Date.now() - otpSentAt) / 1000);
        const remaining = Math.max(0, OTP_RESEND_INTERVAL - elapsed);
        setCountdown(remaining);
    }, [otpSentAt]);

    useEffect(() => {
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [updateCountdown]);

    const handleResend = async () => {
        if (countdown > 0 || isLoading) return;
        await onResend();
    };

    return (
        <div className="text-center">
            {countdown > 0 ? (
                <span className="text-sm text-gray-500">
                    {countdown} 秒后可重新发送
                </span>
            ) : (
                <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                    重新发送验证码
                </button>
            )}
        </div>
    );
}
