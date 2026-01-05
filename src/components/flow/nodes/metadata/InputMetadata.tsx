"use client";
import React from "react";
import type { InputNodeData } from "@/types/flow";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";

export function InputMetadata({ input }: { input: InputNodeData }) {
    const enableText = input?.enableTextInput !== false;
    const enableFile = input?.enableFileInput === true;
    const enableForm = input?.enableStructuredForm === true;
    const formCount = input?.formFields?.length || 0;

    const features: string[] = [];
    if (enableText) features.push("文本");
    if (enableFile) features.push("文件");
    if (enableForm) features.push(`表单(${formCount}项)`);

    if (features.length === 0) return null;

    return (
        <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>输入方式</span>
            <span className={METADATA_VALUE_STYLE}>{features.join(" + ")}</span>
        </div>
    );
}
