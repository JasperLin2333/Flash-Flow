/**
 * QuotaDisplay Component
 * Shows user's current quota usage with progress bars
 */

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQuotaStore } from "@/store/quotaStore";
import { quotaService } from "@/services/quotaService";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Zap, Sparkles, Rocket } from "lucide-react";

interface QuotaDisplayProps {
    compact?: boolean;
    className?: string;
}

export function QuotaDisplay({ compact = false, className = "" }: QuotaDisplayProps) {
    const { user, isAuthenticated } = useAuthStore();
    const { quota, fetchQuota, isLoading, error } = useQuotaStore();

    useEffect(() => {
        if (isAuthenticated && user) {
            fetchQuota(user.id);
        }
    }, [isAuthenticated, user, fetchQuota]);

    if (!isAuthenticated) {
        return null;
    }

    // 显示加载状态
    if (isLoading) {
        return (
            <div className={`text-sm text-gray-400 ${className}`}>
                加载配额...
            </div>
        );
    }

    // 显示错误状态
    if (error || !quota) {
        return (
            <div className={`text-sm text-red-500 ${className}`}>
                {error || "配额信息加载失败"}
            </div>
        );
    }

    const quotaItems = [
        {
            icon: Zap,
            label: "LLM 使用",
            used: quota.llm_executions_used,
            limit: quota.llm_executions_limit,
            iconColor: "text-gray-400",
            progressColor: "bg-black",
        },
        {
            icon: Sparkles,
            label: "Flow（助手） 生成",
            used: quota.flow_generations_used,
            limit: quota.flow_generations_limit,
            iconColor: "text-gray-400",
            progressColor: "bg-black",
        },
        {
            icon: Rocket,
            label: "App （助手） 使用",
            used: quota.app_usages_used,
            limit: quota.app_usages_limit,
            iconColor: "text-gray-400",
            progressColor: "bg-black",
        },
    ];

    if (compact) {
        return (
            <div className={`space-y-3 ${className}`}>
                {quotaItems.map((item) => {
                    const percentage = quotaService.getQuotaPercentage(item.used, item.limit);
                    const isLow = quotaService.isQuotaLow(item.used, item.limit);
                    const isWarning = percentage > 80;
                    const Icon = item.icon;

                    return (
                        <div key={item.label} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon className={`h-3.5 w-3.5 ${isLow ? "text-red-500" : item.iconColor}`} />
                                    <span className="text-xs font-medium text-gray-600">{item.label}</span>
                                </div>
                                <span className={`text-xs font-medium ${isLow ? "text-red-600" : "text-gray-500"}`}>
                                    {item.used}/{item.limit}
                                </span>
                            </div>
                            <Progress
                                value={percentage}
                                className="h-1 bg-gray-50"
                                indicatorClassName={isLow ? "bg-red-500" : isWarning ? "bg-amber-500" : item.progressColor}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <Card className={`p-5 bg-white border border-gray-100 shadow-xl shadow-black/5 ${className}`}>
            <div className="flex items-center gap-2 mb-6">
                <div className="h-1 w-1 rounded-full bg-black" />
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usage Quota</h3>
            </div>

            <div className="space-y-6">
                {quotaItems.map((item) => {
                    const percentage = quotaService.getQuotaPercentage(item.used, item.limit);
                    const isLow = quotaService.isQuotaLow(item.used, item.limit);
                    const remaining = item.limit - item.used;
                    const Icon = item.icon;

                    return (
                        <div key={item.label} className="group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Icon className={`h-3.5 w-3.5 ${isLow ? "text-red-500" : "text-gray-400"}`} />
                                    <span className="text-[13px] font-medium text-gray-800">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={`text-[13px] font-semibold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                                        {item.used}
                                    </span>
                                    <span className="text-[11px] text-gray-400">/ {item.limit}</span>
                                </div>
                            </div>
                            <Progress
                                value={percentage}
                                className="h-1 bg-gray-50 overflow-hidden"
                                indicatorClassName={`${isLow ? "bg-red-500" : "bg-black"} transition-all duration-500`}
                            />
                            {isLow && (
                                <p className="mt-1 text-[10px] text-red-500 font-medium">
                                    仅剩 {remaining} 次可用
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-10 pt-4 border-t border-gray-50 flex items-center justify-center">
                <p className="text-[11px] text-gray-400 flex items-center gap-2">
                    如需提升额度，请联系微信: <span className="text-gray-900 font-medium select-all">JasperXHL</span>
                </p>
            </div>
        </Card>
    );
}
