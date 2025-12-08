import { useRef, useEffect, useCallback } from "react";

/**
 * 智能自动滚动 Hook
 * 
 * 功能：
 * - 当内容更新时自动滚动到底部
 * - 当用户主动滚动（鼠标拖动、滚轮、触摸）时暂停自动滚动
 * - 当用户滚动回底部附近时恢复自动滚动
 * 
 * @param dependencies - 触发滚动的依赖项数组（如 messages, streamingText）
 * @param threshold - 距离底部多少像素内算"在底部"，默认 50px
 */
export function useAutoScroll<T extends HTMLElement = HTMLDivElement>(
    dependencies: unknown[],
    threshold = 50
) {
    const scrollRef = useRef<T>(null);
    const userScrolledRef = useRef(false);
    const isAutoScrollingRef = useRef(false);

    // 检查是否在底部附近
    const isNearBottom = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return true;
        const { scrollTop, scrollHeight, clientHeight } = el;
        return scrollHeight - scrollTop - clientHeight <= threshold;
    }, [threshold]);

    // 滚动到底部
    const scrollToBottom = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        isAutoScrollingRef.current = true;
        el.scrollTop = el.scrollHeight;
        // 使用 requestAnimationFrame 确保滚动完成后重置标志
        requestAnimationFrame(() => {
            isAutoScrollingRef.current = false;
        });
    }, []);

    // 用户滚动事件处理
    const handleUserScroll = useCallback(() => {
        // 如果是程序触发的滚动，忽略
        if (isAutoScrollingRef.current) return;

        // 检查用户是否滚动离开底部
        if (!isNearBottom()) {
            userScrolledRef.current = true;
        } else {
            // 用户滚动回底部，恢复自动滚动
            userScrolledRef.current = false;
        }
    }, [isNearBottom]);

    // 用户开始交互（鼠标按下、触摸开始）- 标记为用户正在交互
    const handleInteractionStart = useCallback(() => {
        // 只有当用户不在底部时才标记
        if (!isNearBottom()) {
            userScrolledRef.current = true;
        }
    }, [isNearBottom]);

    // 注册事件监听器
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        // 监听滚动事件
        el.addEventListener("scroll", handleUserScroll, { passive: true });
        // 监听鼠标按下（用于检测拖动滚动条）
        el.addEventListener("mousedown", handleInteractionStart, { passive: true });
        // 监听触摸开始
        el.addEventListener("touchstart", handleInteractionStart, { passive: true });
        // 监听滚轮事件
        el.addEventListener("wheel", handleInteractionStart, { passive: true });

        return () => {
            el.removeEventListener("scroll", handleUserScroll);
            el.removeEventListener("mousedown", handleInteractionStart);
            el.removeEventListener("touchstart", handleInteractionStart);
            el.removeEventListener("wheel", handleInteractionStart);
        };
    }, [handleUserScroll, handleInteractionStart]);

    // 当依赖项变化时，如果用户没有主动滚动过，则自动滚动到底部
    useEffect(() => {
        if (!userScrolledRef.current) {
            scrollToBottom();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);

    // 重置用户滚动状态（例如：新对话开始时）
    const resetScroll = useCallback(() => {
        userScrolledRef.current = false;
        scrollToBottom();
    }, [scrollToBottom]);

    return {
        scrollRef,
        scrollToBottom,
        resetScroll,
        isUserScrolled: () => userScrolledRef.current,
    };
}
