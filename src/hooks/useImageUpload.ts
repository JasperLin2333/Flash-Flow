/**
 * useImageUpload Hook
 * 
 * Encapsulates image upload logic for ImageGen node forms and dialogs.
 * Handles file validation, local preview, upload to storage, and state management.
 */

import { useState, useRef, useCallback } from "react";
import { fileUploadService } from "@/services/fileUploadService";
import { showError } from "@/utils/errorNotify";

// Validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export interface ImageUploadState {
    isUploading: Record<string, boolean>;
    localPreviews: Record<string, string>;
}

export interface UseImageUploadOptions {
    nodeId: string | null;
    flowId: string | null;
    maxSlots?: number;
}

export interface ImageUploadResult {
    // State
    isUploading: Record<string, boolean>;
    localPreviews: Record<string, string>;
    fileInputRefs: React.RefObject<HTMLInputElement | null>[];

    // Actions
    handleUpload: (files: FileList | null, slotIndex: number) => Promise<string | null>;
    clearPreview: (slotIndex: number) => void;
    reset: () => void;
}

export function useImageUpload({
    nodeId,
    flowId,
    maxSlots = 3,
}: UseImageUploadOptions): ImageUploadResult {
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});

    // Create refs for each slot
    const fileInputRefs = Array.from({ length: maxSlots }, () =>
        useRef<HTMLInputElement | null>(null)
    );

    const handleUpload = useCallback(async (
        files: FileList | null,
        slotIndex: number
    ): Promise<string | null> => {
        if (!files || files.length === 0 || !nodeId || !flowId) {
            return null;
        }

        const file = files[0];
        const slotKey = String(slotIndex);

        // Validate file type
        if (!SUPPORTED_TYPES.includes(file.type)) {
            showError("文件类型错误", "请上传图片文件 (PNG, JPG, JPEG, WEBP)");
            return null;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            showError("文件过大", "图片大小不能超过 10MB");
            return null;
        }

        // Create local preview
        const previewUrl = URL.createObjectURL(file);
        setLocalPreviews(prev => ({ ...prev, [slotKey]: previewUrl }));
        setIsUploading(prev => ({ ...prev, [slotKey]: true }));

        try {
            const result = await fileUploadService.completeUpload(file, nodeId, flowId);

            if (result) {
                // Clear local preview on success (actual URL will be used)
                setLocalPreviews(prev => {
                    const next = { ...prev };
                    delete next[slotKey];
                    return next;
                });
                return result.url;
            } else {
                throw new Error("上传失败");
            }
        } catch (error) {
            showError("上传失败", error instanceof Error ? error.message : "未知错误");
            setLocalPreviews(prev => {
                const next = { ...prev };
                delete next[slotKey];
                return next;
            });
            return null;
        } finally {
            setIsUploading(prev => ({ ...prev, [slotKey]: false }));
            URL.revokeObjectURL(previewUrl);
        }
    }, [nodeId, flowId]);

    const clearPreview = useCallback((slotIndex: number) => {
        const slotKey = String(slotIndex);
        setLocalPreviews(prev => {
            const next = { ...prev };
            delete next[slotKey];
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        // Revoke all preview URLs
        Object.values(localPreviews).forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // Ignore errors
            }
        });
        setLocalPreviews({});
        setIsUploading({});
    }, [localPreviews]);

    return {
        isUploading,
        localPreviews,
        fileInputRefs,
        handleUpload,
        clearPreview,
        reset,
    };
}
