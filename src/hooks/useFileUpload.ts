/**
 * useFileUpload Hook
 * 
 * Generic file upload hook for workflow components.
 * Handles file validation, batch upload to storage, and state management.
 * 
 * Design decisions:
 * - Returns errors instead of displaying them (caller decides how to handle)
 * - Separate from useImageUpload which is specialized for ImageGen slots
 */

import { useState, useCallback } from "react";
import { fileUploadService } from "@/services/fileUploadService";
import { validateFileType } from "@/utils/fileUtils";

// ============ Types ============

export interface FileUploadConfig {
    maxSizeMB?: number;
    maxCount?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
}

export interface UploadedFile {
    name: string;
    url: string;
    size: number;
    type: string;
}

export interface ValidationResult {
    valid: File[];
    errors: string[];
}

export interface UploadResult {
    files: UploadedFile[];
    errors: string[];
}

export interface UseFileUploadResult {
    isUploading: boolean;
    validateFiles: (files: File[], existingCount?: number) => ValidationResult;
    uploadFiles: (files: File[], existingCount?: number) => Promise<UploadResult>;
}

// ============ Default Config ============

const DEFAULT_CONFIG: Required<FileUploadConfig> = {
    maxSizeMB: 100,
    maxCount: 10,
    allowedTypes: ["*/*"],
    allowedExtensions: [],
};

// ============ Helpers ============

// Local helpers
function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : "";
}

// ============ Hook ============

export function useFileUpload(
    nodeId: string | null,
    flowId: string | null,
    config?: FileUploadConfig
): UseFileUploadResult {
    const [isUploading, setIsUploading] = useState(false);
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const maxSizeBytes = mergedConfig.maxSizeMB * 1024 * 1024;

    const validateFiles = useCallback((
        files: File[],
        existingCount: number = 0
    ): ValidationResult => {
        const valid: File[] = [];
        const errors: string[] = [];

        if (existingCount + files.length > mergedConfig.maxCount) {
            errors.push("最多只能上传 " + mergedConfig.maxCount + " 个文件，当前已有 " + existingCount + " 个");
            return { valid: [], errors };
        }

        for (const file of files) {
            if (file.size > maxSizeBytes) {
                errors.push("文件 \"" + file.name + "\" 超过最大体积 " + mergedConfig.maxSizeMB + "MB");
                continue;
            }
            if (mergedConfig.allowedExtensions.length > 0) {
                const ext = getFileExtension(file.name);
                if (!mergedConfig.allowedExtensions.includes(ext)) {
                    errors.push("不支持的文件类型: " + file.name);
                    continue;
                }
            } else if (!validateFileType(file, mergedConfig.allowedTypes)) {
                errors.push("不支持的文件类型: " + file.name);
                continue;
            }
            valid.push(file);
        }
        return { valid, errors };
    }, [mergedConfig, maxSizeBytes]);

    const uploadFiles = useCallback(async (
        files: File[],
        existingCount: number = 0
    ): Promise<UploadResult> => {
        if (!nodeId || !flowId) {
            return { files: [], errors: ["缺少 nodeId 或 flowId"] };
        }
        const validation = validateFiles(files, existingCount);
        if (validation.errors.length > 0 && validation.valid.length === 0) {
            return { files: [], errors: validation.errors };
        }

        setIsUploading(true);
        const uploadedFiles: UploadedFile[] = [];
        const errors: string[] = [...validation.errors];

        try {
            for (const file of validation.valid) {
                const result = await fileUploadService.uploadFile(file, nodeId, flowId);
                if (result) {
                    uploadedFiles.push({
                        name: file.name,
                        url: result.url,
                        size: file.size,
                        type: file.type,
                    });
                } else {
                    errors.push("上传失败: " + file.name);
                }
            }
        } catch (err) {
            errors.push(err instanceof Error ? err.message : "上传失败");
        } finally {
            setIsUploading(false);
        }
        return { files: uploadedFiles, errors };
    }, [nodeId, flowId, validateFiles]);

    return {
        isUploading,
        validateFiles,
        uploadFiles,
    };
}
