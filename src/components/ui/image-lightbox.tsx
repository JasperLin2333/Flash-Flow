"use client";

import { useState, memo, useCallback } from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
    src?: string;
    alt?: string;
    className?: string;
}

/**
 * ImageLightbox - 图片点击放大组件
 * 
 * 点击图片后全屏展示，支持:
 * - ESC 关闭
 * - 点击遮罩关闭
 * - 关闭按钮
 */
export const ImageLightbox = memo(function ImageLightbox({
    src,
    alt = "",
    className = ""
}: ImageLightboxProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpen = useCallback(() => {
        setIsOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            handleClose();
        }
    }, [handleClose]);

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }, [handleClose]);

    return (
        <>
            {/* 缩略图 */}
            <img
                src={src}
                alt={alt}
                className={`max-w-full h-auto rounded-lg my-2 border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity ${className}`}
                loading="lazy"
                onClick={handleOpen}
            />

            {/* Lightbox 弹窗 */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={handleBackdropClick}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    role="dialog"
                    aria-modal="true"
                    aria-label={alt || "图片预览"}
                >
                    {/* 关闭按钮 */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                        aria-label="关闭"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* 大图 */}
                    <img
                        src={src}
                        alt={alt}
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                    />

                    {/* 图片说明 */}
                    {alt && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white text-sm rounded-lg max-w-[80vw] text-center truncate">
                            {alt}
                        </div>
                    )}
                </div>
            )}
        </>
    );
});
