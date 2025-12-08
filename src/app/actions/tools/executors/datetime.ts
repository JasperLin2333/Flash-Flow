import type { ToolExecutionResult } from "../types";
import { formatDate, parseDate } from "../types";

/**
 * Datetime operation input types
 */
export interface DatetimeInputs {
    operation?: "now" | "format" | "diff" | "add";
    date?: string;
    targetDate?: string;
    format?: string;
    amount?: number;
    unit?: "year" | "month" | "day" | "hour" | "minute" | "second";
}

/**
 * Execute Datetime operations
 * Supports: now (get current time), format, diff (date difference), add (date arithmetic)
 */
export async function executeDatetime(inputs: DatetimeInputs): Promise<ToolExecutionResult> {
    try {
        const operation = inputs.operation || "now";
        const formatStr = inputs.format || "YYYY-MM-DD HH:mm:ss";

        switch (operation) {
            case "now": {
                const now = new Date();
                return {
                    success: true,
                    data: {
                        operation: "now",
                        formatted: formatDate(now, formatStr),
                        timestamp: now.getTime(),
                        iso: now.toISOString(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                };
            }

            case "format": {
                const date = parseDate(inputs.date);
                return {
                    success: true,
                    data: {
                        operation: "format",
                        input: inputs.date || "当前时间",
                        formatted: formatDate(date, formatStr),
                        format: formatStr,
                    },
                };
            }

            case "diff": {
                if (!inputs.targetDate) {
                    return {
                        success: false,
                        error: "计算日期差需要提供目标日期 (targetDate)",
                    };
                }
                const date1 = parseDate(inputs.date);
                const date2 = parseDate(inputs.targetDate);
                const diffMs = date2.getTime() - date1.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinutes = Math.floor(diffMs / (1000 * 60));

                return {
                    success: true,
                    data: {
                        operation: "diff",
                        from: formatDate(date1, "YYYY-MM-DD"),
                        to: formatDate(date2, "YYYY-MM-DD"),
                        difference: {
                            days: diffDays,
                            hours: diffHours,
                            minutes: diffMinutes,
                            milliseconds: diffMs,
                        },
                        humanReadable: `${Math.abs(diffDays)} 天`,
                    },
                };
            }

            case "add": {
                if (inputs.amount === undefined) {
                    return {
                        success: false,
                        error: "日期加减需要提供数量 (amount)",
                    };
                }
                const unit = inputs.unit || "day";
                const date = parseDate(inputs.date);
                const amount = inputs.amount;

                switch (unit) {
                    case "year":
                        date.setFullYear(date.getFullYear() + amount);
                        break;
                    case "month":
                        date.setMonth(date.getMonth() + amount);
                        break;
                    case "day":
                        date.setDate(date.getDate() + amount);
                        break;
                    case "hour":
                        date.setHours(date.getHours() + amount);
                        break;
                    case "minute":
                        date.setMinutes(date.getMinutes() + amount);
                        break;
                    case "second":
                        date.setSeconds(date.getSeconds() + amount);
                        break;
                }

                return {
                    success: true,
                    data: {
                        operation: "add",
                        originalDate: inputs.date || "当前时间",
                        amount,
                        unit,
                        result: formatDate(date, formatStr),
                        iso: date.toISOString(),
                    },
                };
            }

            default:
                return {
                    success: false,
                    error: `未知的操作类型: ${operation}`,
                };
        }
    } catch (error) {
        console.error("Datetime error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "日期时间操作失败",
        };
    }
}
