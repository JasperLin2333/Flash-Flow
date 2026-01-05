/**
 * ImageSlotUploader Component
 * 
 * Reusable component for image upload slots in ImageGen forms.
 * Supports both "main" (主图) and "sub" (副图) slot types.
 */

"use client";
import React, { useRef } from "react";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";

export interface ImageSlotUploaderProps {
    slotIndex: 1 | 2 | 3;
    slotType: "main" | "sub";
    currentUrl: string;
    localPreview?: string;
    isUploading: boolean;
    onUpload: (files: FileList | null) => void;
    onDelete: () => void;
    onRemoveSlot?: () => void; // Only for sub slots
    inputId: string;
}

export function ImageSlotUploader({
    slotIndex,
    slotType,
    currentUrl,
    localPreview,
    isUploading,
    onUpload,
    onDelete,
    onRemoveSlot,
    inputId,
}: ImageSlotUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasImage = currentUrl || localPreview;

    const labelText = slotType === "main" ? "主图" : "副图";
    const badgeClasses = slotType === "main"
        ? "bg-blue-100 text-blue-700"
        : "bg-orange-100 text-orange-600";
    const numberClasses = slotType === "main"
        ? "text-blue-600"
        : "text-gray-500";
    const uploadText = slotType === "main" ? "点击上传主图" : "点击上传副图";

    return (
        <div className="space-y-1">
            {/* Slot Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] ${numberClasses} font-medium`}>
                        {slotIndex}.
                    </span>
                    <span className={`text-[9px] ${badgeClasses} px-1.5 py-0.5 rounded`}>
                        {labelText}
                    </span>
                </div>
                {/* Remove slot button - only for sub slots */}
                {slotType === "sub" && onRemoveSlot && (
                    <button
                        type="button"
                        onClick={onRemoveSlot}
                        className="text-gray-400 hover:text-red-500"
                    >
                        <span className="text-xs">× 移除</span>
                    </button>
                )}
            </div>

            {/* Content: Preview or Upload Area */}
            {hasImage ? (
                // Uploaded State - Image Preview
                <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                        <img
                            src={localPreview || currentUrl}
                            alt="参考图预览"
                            className="w-full h-full object-cover"
                        />
                        {isUploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">
                            {isUploading ? "上传中..." : "参考图已上传"}
                        </p>
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={isUploading}
                            className="mt-1 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-3 h-3" />
                            删除
                        </button>
                    </div>
                </div>
            ) : (
                // Upload Area
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center transition-all duration-150 hover:border-gray-400 hover:bg-gray-50 cursor-pointer">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        id={inputId}
                        onChange={(e) => onUpload(e.target.files)}
                        disabled={isUploading}
                    />
                    <label htmlFor={inputId} className="cursor-pointer block">
                        <ImagePlus className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                        <div className="text-xs font-medium text-gray-600">{uploadText}</div>
                    </label>
                </div>
            )}
        </div>
    );
}
