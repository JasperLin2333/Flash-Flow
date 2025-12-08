import { StateCreator } from "zustand";
import type { FlowState } from "@/types/flow";

export interface StreamingActions {
    setStreamingText: (text: string) => void;
    appendStreamingText: (chunk: string) => void;
    clearStreaming: () => void;
    abortStreaming: () => void;
    resetStreamingAbort: () => void;
}

export const createStreamingActions: StateCreator<
    FlowState,
    [],
    [],
    StreamingActions
> = (set, get) => ({
    // ===== Streaming Actions =====
    setStreamingText: (text: string) => set({ streamingText: text, isStreaming: true }),

    appendStreamingText: (chunk: string) => set((state: FlowState) => {
        // 如果 streaming 已被主动中断（用户点击了"新建对话"），则忽略后续的流式内容
        if ((state as any)._streamingAborted) {
            return state; // 不做任何改变
        }
        return {
            streamingText: state.streamingText + chunk,
            isStreaming: true,
        };
    }),

    // 正常清理 streaming（开始新的 streaming 前调用）
    clearStreaming: () => set({ streamingText: "", isStreaming: false }),

    // 主动中断 streaming（用户点击新建对话时调用）
    abortStreaming: () => set({ streamingText: "", isStreaming: false, _streamingAborted: true } as any),

    // 重置中断标志（开始新的 streaming 前调用）
    resetStreamingAbort: () => set({ _streamingAborted: false } as any),
});
