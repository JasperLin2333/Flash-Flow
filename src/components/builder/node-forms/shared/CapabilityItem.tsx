"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CapabilityItemProps {
    /** Icon component to display on the left */
    icon: React.ReactNode;
    /** Title of the capability */
    title: string;
    /** Description or subtitle */
    description: string;
    /** Element to render on the right (e.g., Switch) */
    rightElement?: React.ReactNode;
    /** Content to render when expanded/enabled */
    children?: React.ReactNode;
    /** Controls visibility of the children content */
    isExpanded?: boolean;
    /** Background color class for the icon container (e.g., "bg-blue-50 text-blue-600") */
    iconColorClass?: string;
    /** Optional custom class name for the container */
    className?: string;
}

/**
 * CapabilityItem - 通用的能力配置列表项
 * 用于 Input 节点、LLM 节点等需要“列表+开关+内联配置”的场景
 */
export function CapabilityItem({
    icon,
    title,
    description,
    rightElement,
    children,
    isExpanded = false,
    iconColorClass = "bg-gray-100 text-gray-600",
    className,
}: CapabilityItemProps) {
    return (
        <div className={cn("transition-colors duration-200", isExpanded ? "bg-gray-50/30" : "hover:bg-gray-50/50", className)}>
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg mt-0.5 shrink-0", iconColorClass)}>
                        {icon}
                    </div>
                    <div>
                        <span className="text-sm font-semibold text-gray-900 block">{title}</span>
                        <span className="text-[11px] text-gray-500 block mt-0.5 leading-tight">{description}</span>
                    </div>
                </div>
                {rightElement}
            </div>
            
            {/* Inline Configuration Area */}
            {isExpanded && children && (
                <div className="px-4 pb-5 pt-0 pl-[52px] animate-in slide-in-from-top-1 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}
