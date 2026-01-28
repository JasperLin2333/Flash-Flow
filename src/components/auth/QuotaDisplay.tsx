/**
 * QuotaDisplay Component
 * Shows user's current quota usage with progress bars
 */

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQuotaStore } from "@/store/quotaStore";
import { quotaService } from "@/services/quotaService";
import { Card } from "@/components/ui/card";
import type { PointsLedgerEntry } from "@/types/auth";

interface QuotaDisplayProps {
    compact?: boolean;
    className?: string;
}

export function QuotaDisplay({ compact = false, className = "" }: QuotaDisplayProps) {
    const { user, isAuthenticated } = useAuthStore();
    const { quota, fetchQuota, isLoading, error } = useQuotaStore();
    const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);

    useEffect(() => {
        if (isAuthenticated && user) {
            fetchQuota(user.id);
        }
    }, [isAuthenticated, user, fetchQuota]);

    useEffect(() => {
        let isActive = true;
        if (isAuthenticated && user) {
            quotaService.getPointsLedger(user.id, compact ? 4 : 8).then((entries) => {
                if (isActive) {
                    setLedger(entries);
                }
            });
        }
        return () => {
            isActive = false;
        };
    }, [isAuthenticated, user, compact]);

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

    if (compact) {
        return (
            <div className={`space-y-4 ${className}`}>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">可用算力</div>
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">
                        {quota.points_balance}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="text-[11px] font-medium text-gray-400 px-1">算力账单</div>
                    {ledger.length === 0 && (
                        <div className="text-xs text-gray-400 px-1">暂无记录</div>
                    )}
                    <div className="space-y-1">
                        {ledger.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between text-xs py-1.5 px-1 hover:bg-gray-50 rounded transition-colors">
                                <span className="text-gray-600 truncate max-w-[140px]">{entry.title}</span>
                                <span className="font-mono text-gray-500">
                                    {((entry.item_key === "initial_grant") || (entry.title || "").includes("初始")) ? `+${entry.points}` : `-${entry.points}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Card className={`p-5 bg-white border border-gray-100 shadow-xl shadow-black/5 ${className}`}>
            <div className="flex items-center gap-2 mb-6">
                <div className="h-1 w-1 rounded-full bg-black" />
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">COMPUTE</h3>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">可用算力</span>
                    <span className="text-xl font-semibold text-gray-900">{quota.points_balance}</span>
                </div>
                <div className="space-y-3">
                    <div className="text-[11px] text-gray-400">算力账单</div>
                    {ledger.length === 0 && (
                        <div className="text-xs text-gray-400">暂无记录</div>
                    )}
                    {ledger.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between text-sm">
                            <div className="flex flex-col">
                                <span className="text-gray-700">{entry.title}</span>
                                <span className="text-[11px] text-gray-400">
                                    {new Date(entry.created_at).toLocaleString()}
                                </span>
                            </div>
                            <span className="text-gray-500">
                                {((entry.item_key === "initial_grant") || (entry.title || "").includes("初始")) ? `+${entry.points}` : `-${entry.points}`}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-10 pt-4 border-t border-gray-50 flex items-center justify-center">
                <p className="text-[11px] text-gray-400 flex items-center gap-2">
                    获取更多算力，请联系微信: <span className="text-gray-900 font-medium select-all">JasperXHL</span>
                </p>
            </div>
        </Card>
    );
}
