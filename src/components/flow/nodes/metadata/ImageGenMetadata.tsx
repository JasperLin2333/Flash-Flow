"use client";
import React from "react";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";
import { getImageGenModelName, getImageGenSizeName } from "@/store/constants/imageGenConstants";
import { MODEL_CAPABILITIES } from "@/services/imageGenModelsAPI";
import type { ImageGenNodeData } from "@/types/flow";

export function ImageGenMetadata({ imageGen }: { imageGen: ImageGenNodeData }) {
    const model = imageGen?.model;
    const imageSize = imageGen?.imageSize;

    const modelName = getImageGenModelName(model);
    const sizeName = getImageGenSizeName(imageSize);
    const supportsImageSize = model ? MODEL_CAPABILITIES[model]?.supportsImageSize !== false : true;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className={METADATA_LABEL_STYLE}>绘画模型</span>
                <span className={METADATA_VALUE_STYLE}>{modelName}</span>
            </div>
            {imageSize && supportsImageSize && (
                <div className="flex items-center gap-2">
                    <span className={METADATA_LABEL_STYLE}>画幅比例</span>
                    <span className={METADATA_VALUE_STYLE}>{sizeName}</span>
                </div>
            )}
        </div>
    );
}
