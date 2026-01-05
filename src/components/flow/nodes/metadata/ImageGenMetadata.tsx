"use client";
import React from "react";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";
import { getImageGenModelName, getImageGenSizeName } from "@/store/constants/imageGenConstants";
import type { ImageGenNodeData } from "@/types/flow";

export function ImageGenMetadata({ imageGen }: { imageGen: ImageGenNodeData }) {
    const model = imageGen?.model;
    const imageSize = imageGen?.imageSize;

    const modelName = getImageGenModelName(model);
    const sizeName = getImageGenSizeName(imageSize);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className={METADATA_LABEL_STYLE}>模型</span>
                <span className={METADATA_VALUE_STYLE}>{modelName}</span>
            </div>
            {imageSize && (
                <div className="flex items-center gap-2">
                    <span className={METADATA_LABEL_STYLE}>比例</span>
                    <span className={METADATA_VALUE_STYLE}>{sizeName}</span>
                </div>
            )}
        </div>
    );
}
