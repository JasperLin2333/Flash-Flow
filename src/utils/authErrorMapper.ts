/**
 * Auth Error Message Mapper
 * Converts Supabase Auth error messages to user-friendly Chinese messages
 */

// Common Supabase Auth error message patterns and their translations
const ERROR_MAPPINGS: Array<{ pattern: RegExp | string; message: string }> = [
    // Credential errors
    { pattern: /invalid.*credentials/i, message: "邮箱或密码错误" },
    { pattern: /invalid.*password/i, message: "密码错误" },
    { pattern: /invalid.*email/i, message: "邮箱格式不正确" },
    { pattern: /email.*required/i, message: "请输入邮箱地址" },
    { pattern: /password.*required/i, message: "请输入密码" },

    // User existence errors
    { pattern: /user.*not.*found/i, message: "该邮箱未注册" },
    { pattern: /user.*already.*registered/i, message: "该邮箱已被注册" },
    { pattern: /email.*already.*in.*use/i, message: "该邮箱已被使用" },
    { pattern: /signups.*not.*allowed/i, message: "该邮箱未注册" },

    // Password strength
    { pattern: /password.*too.*short/i, message: "密码至少需要 6 位字符" },
    { pattern: /password.*too.*weak/i, message: "密码强度不足，请使用更复杂的密码" },
    { pattern: /password.*should.*be.*at.*least/i, message: "密码至少需要 6 位字符" },

    // OTP/Verification errors
    { pattern: /otp.*expired/i, message: "验证码已过期，请重新发送" },
    { pattern: /otp.*invalid/i, message: "验证码错误，请检查后重试" },
    { pattern: /token.*expired/i, message: "验证码已过期，请重新发送" },
    { pattern: /invalid.*token/i, message: "验证码错误，请检查后重试" },
    { pattern: /token.*not.*found/i, message: "验证码错误，请检查后重试" },

    // Rate limiting
    { pattern: /too.*many.*requests/i, message: "请求过于频繁，请稍后再试" },
    { pattern: /rate.*limit/i, message: "请求过于频繁，请稍后再试" },
    { pattern: /email.*rate.*limit/i, message: "发送邮件过于频繁，请稍后再试" },

    // Session errors
    { pattern: /session.*expired/i, message: "登录已过期，请重新登录" },
    { pattern: /not.*authenticated/i, message: "请先登录" },
    { pattern: /refresh.*token.*invalid/i, message: "登录已过期，请重新登录" },

    // Network errors
    { pattern: /network/i, message: "网络连接失败，请检查网络后重试" },
    { pattern: /fetch/i, message: "网络请求失败，请检查网络后重试" },
    { pattern: /timeout/i, message: "请求超时，请检查网络后重试" },

    // Generic errors
    { pattern: /server.*error/i, message: "服务器错误，请稍后重试" },
    { pattern: /internal.*error/i, message: "服务器错误，请稍后重试" },
];

/**
 * Map an error message to a user-friendly Chinese message
 * @param errorMessage - The original error message (usually from Supabase)
 * @returns A user-friendly Chinese error message
 */
export function mapAuthError(errorMessage: string | null | undefined): string {
    if (!errorMessage) {
        return "操作失败，请稍后重试";
    }

    // Check each pattern
    for (const { pattern, message } of ERROR_MAPPINGS) {
        if (typeof pattern === "string") {
            if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
                return message;
            }
        } else if (pattern.test(errorMessage)) {
            return message;
        }
    }

    // If no match found, check if the message is already in Chinese
    if (/[\u4e00-\u9fa5]/.test(errorMessage)) {
        return errorMessage; // Already in Chinese, return as-is
    }

    // Default fallback
    console.warn("[mapAuthError] Unmapped error:", errorMessage);
    return "操作失败，请稍后重试";
}

/**
 * Wrap an error object with a user-friendly message
 */
export function friendlyAuthError(error: Error | null): Error | null {
    if (!error) return null;
    const friendlyMessage = mapAuthError(error.message);
    const newError = new Error(friendlyMessage);
    newError.cause = error;
    return newError;
}
