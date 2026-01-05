"use client";
import React from "react";

/**
 * 统一的表单分割线组件
 * 用于区分节点表单中的不同逻辑区块
 */
import { cn } from "@/lib/utils";

/**
 * 统一的表单分割线组件
 * 用于区分节点表单中的不同逻辑区块
 */
interface FormSeparatorProps {
    className?: string;
}

export function FormSeparator({ className }: FormSeparatorProps) {
    return <div className={cn("border-t border-gray-100 my-4", className)} />;
}

