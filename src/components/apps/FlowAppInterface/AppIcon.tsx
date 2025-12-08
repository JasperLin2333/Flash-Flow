import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_MAP, DEFAULT_ICON, STYLES, type FlowIconConfig } from "./constants";

interface AppIconProps {
    flowIcon?: FlowIconConfig;
    className?: string;
}

/**
 * AppIcon - 应用图标组件
 * 支持多种图标类型：image, lucide, emoji
 */
export function AppIcon({ flowIcon, className }: AppIconProps) {
    if (flowIcon?.kind === "image" && flowIcon.url) {
        return (
            <img
                src={flowIcon.url}
                alt="flow icon"
                className={cn(STYLES.iconSize, "rounded-full object-cover", className)}
            />
        );
    }

    if (flowIcon?.kind === "lucide" && flowIcon.name) {
        const Icon = ICON_MAP[flowIcon.name as keyof typeof ICON_MAP] || DEFAULT_ICON;
        return (
            <div className={cn(STYLES.iconSize, "rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700", className)}>
                <Icon className={cn(STYLES.iconSize, "p-1.5", className)} />
            </div>
        );
    }

    if (flowIcon?.kind === "emoji" && flowIcon.name) {
        return (
            <div className={cn(STYLES.iconSize, "rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-base", className)}>
                {flowIcon.name}
            </div>
        );
    }

    return (
        <div className={cn(STYLES.iconSize, "rounded-full bg-black flex items-center justify-center text-white", className)}>
            <Bot className={cn(STYLES.iconSize, "p-1.5", className)} />
        </div>
    );
}
