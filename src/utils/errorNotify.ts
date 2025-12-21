/**
 * 统一错误通知工具函数
 * 封装 toast 调用，提供一致的错误/警告/成功反馈
 */

import { toast } from "@/hooks/use-toast";

/**
 * 显示错误提示
 * @param title 错误标题
 * @param description 可选的详细描述
 */
export function showError(title: string, description?: string): void {
    toast({
        variant: "destructive",
        title,
        description,
    });
}

/**
 * 显示警告提示
 * @param title 警告标题
 * @param description 可选的详细描述
 */
export function showWarning(title: string, description?: string): void {
    toast({
        title: `⚠️ ${title}`,
        description,
    });
}

/**
 * 显示成功提示
 * @param title 成功标题
 * @param description 可选的详细描述
 */
export function showSuccess(title: string, description?: string): void {
    toast({
        title: `✅ ${title}`,
        description,
    });
}

/**
 * 显示信息提示
 * @param title 提示标题
 * @param description 可选的详细描述
 */
export function showInfo(title: string, description?: string): void {
    toast({
        title,
        description,
    });
}
