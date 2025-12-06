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
    const { quota, fetchQuota } = useQuotaStore();

    useEffect(() => {
        if (isAuthenticated && user) {
            fetchQuota(user.id);
        }
    }, [isAuthenticated, user, fetchQuota]);

    if (!isAuthenticated || !quota) {
        return null;
    }

    const quotaItems = [
        {
            icon: Zap,
            label: "LLM 使用",
            used: quota.llm_executions_used,
            limit: quota.llm_executions_limit,
            color: "text-gray-700",
            bgColor: "bg-gray-900",
        },
        {
            icon: Sparkles,
            label: "Flow（助手） 生成",
            used: quota.flow_generations_used,
            limit: quota.flow_generations_limit,
            color: "text-gray-700",
            bgColor: "bg-gray-900",
        },
        {
            icon: Rocket,
            label: "App （助手） 使用",
            used: quota.app_usages_used,
            limit: quota.app_usages_limit,
            color: "text-gray-700",
            bgColor: "bg-gray-900",
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
                                    <Icon className={`h-3.5 w-3.5 ${isLow ? "text-red-500" : "text-zinc-500"}`} />
                                    <span className="text-xs font-medium text-zinc-600">{item.label}</span>
                                </div>
                                <span className={`text-xs font-medium ${isLow ? "text-red-600" : "text-zinc-500"}`}>
                                    {item.used}/{item.limit}
                                </span>
                            </div>
                            <Progress
                                value={percentage}
                                className="h-1 bg-zinc-100"
                                indicatorClassName={isLow ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-zinc-800"}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <Card className={`p-5 bg-white border-0 shadow-xl shadow-black/5 ${className}`}>
            <div className="flex items-center gap-2 mb-6">
                <div className="h-1 w-1 rounded-full bg-zinc-900" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Usage Quota</h3>
            </div>

            <div className="space-y-5">
                {quotaItems.map((item) => {
                    const percentage = quotaService.getQuotaPercentage(item.used, item.limit);
                    const isLow = quotaService.isQuotaLow(item.used, item.limit);
                    const remaining = item.limit - item.used;
                    const Icon = item.icon;

                    return (
                        <div key={item.label} className="group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-md ${isLow ? "bg-red-50" : "bg-zinc-50"} group-hover:bg-zinc-100 transition-colors`}>
                                        <Icon className={`h-3.5 w-3.5 ${isLow ? "text-red-500" : "text-zinc-600"}`} />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-700">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-medium ${isLow ? "text-red-600" : "text-zinc-900"}`}>
                                        {item.used}
                                    </span>
                                    <span className="text-xs text-zinc-400">/ {item.limit}</span>
                                </div>
                            </div>
                            <Progress
                                value={percentage}
                                className="h-1 bg-zinc-100"
                                indicatorClassName={isLow ? "bg-red-500" : "bg-zinc-900"}
                            />
                            {isLow && (
                                <p className="mt-1.5 text-[10px] font-medium text-red-600 pl-1">
                                    仅剩 {remaining} 次
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
