"use client";
import React from "react";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";

export function BranchMetadata({ branch }: { branch: import("@/types/flow").BranchNodeData }) {
    const condition = branch?.condition;

    if (!condition) return null;

    // 截断过长的条件表达式
    const displayCondition = condition.length > 30
        ? condition.slice(0, 27) + "..."
        : condition;

    return (
        <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>判断逻辑</span>
            <span className={METADATA_VALUE_STYLE}>{displayCondition}</span>
        </div>
    );
}
