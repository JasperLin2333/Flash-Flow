"use client";
import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";


interface ResizeHandleProps {
    /** Current panel width */
    width: number;
    /** Minimum allowed width */
    minWidth?: number;
    /** Maximum allowed width */
    maxWidth?: number;
    /** Callback when width changes */
    onWidthChange: (newWidth: number) => void;
    /** Right offset of the panel (default 24px = 1.5rem) */
    rightOffset?: number;
}

/**
 * ResizeHandle - 可拖拽调整面板宽度的手柄组件
 * 
 * 使用方式：放置在面板左侧边缘，用户可以向左拖拽来增加面板宽度
 */
export function ResizeHandle({
    width,
    minWidth = 280,
    maxWidth = 800,
    onWidthChange,
    rightOffset = 24,
}: ResizeHandleProps) {
    const [isDragging, setIsDragging] = useState(false);

    // Handle mouse move during drag
    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;

            // Calculate new width based on mouse position
            // Width = viewport width - mouse X - right offset
            const newWidth = window.innerWidth - e.clientX - rightOffset;

            // Clamp to min/max bounds
            const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

            onWidthChange(clampedWidth);
        },
        [isDragging, minWidth, maxWidth, onWidthChange, rightOffset]
    );

    // Handle mouse up to stop dragging
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, []);

    // Attach/detach global event listeners
    useEffect(() => {
        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            // Prevent text selection while dragging
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Start dragging on mouse down
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    return (
        <div
            className={cn(
                // Position on left edge
                "absolute left-0 top-0 bottom-0 w-5 cursor-col-resize z-50 flex items-center group",
                // Visual feedback for the area
                "start-0"
            )}
            onMouseDown={handleMouseDown}
        >
            {/* Visual indicator line */}
            <div
                className={cn(
                    "absolute left-0 top-0 bottom-0 w-[2px]",
                    "bg-transparent transition-colors duration-150",
                    "group-hover:bg-gray-300",
                    isDragging ? "bg-gray-400" : "hover:bg-gray-300"
                )}
            />
            {/* Draggable Icon Handle */}
            <div
                className={cn(
                    "flex items-center justify-center w-4 h-8 z-10"
                )}
            >
                <div
                    className={cn(
                        "w-1 h-4 rounded-full transition-colors duration-200",
                        isDragging
                            ? "bg-gray-600"
                            : "bg-gray-300 group-hover:bg-gray-400"
                    )}
                />
            </div>
        </div>
    );
}
