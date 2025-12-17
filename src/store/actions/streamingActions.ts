import { StateCreator } from "zustand";
import type { FlowState } from "@/types/flow";

// ============ Segment Streaming Types ============

export type StreamingMode = 'single' | 'segmented' | 'select';

export interface StreamSegment {
    sourceId: string;    // LLM node ID that produced this content
    content: string;     // Accumulated content
    status: 'waiting' | 'streaming' | 'completed' | 'error';
}

export interface StreamingActions {
    // Legacy single-stream actions (backward compatible)
    setStreamingText: (text: string) => void;
    appendStreamingText: (chunk: string) => void;
    clearStreaming: () => void;
    abortStreaming: () => void;
    resetStreamingAbort: () => void;

    // New: Segment streaming for merge mode
    initSegmentedStreaming: (sourceIds: string[]) => void;
    appendToSegment: (sourceId: string, chunk: string) => void;
    completeSegment: (sourceId: string) => void;
    failSegment: (sourceId: string, error: string) => void;

    // New: Select mode (first-char-lock)
    initSelectStreaming: (sourceIds: string[]) => void;
    tryLockSource: (sourceId: string) => boolean;
}

export const createStreamingActions: StateCreator<
    FlowState,
    [],
    [],
    StreamingActions
> = (set, get) => ({
    // ===== Legacy Single-Stream Actions (Backward Compatible) =====
    setStreamingText: (text: string) => set({ streamingText: text, isStreaming: true }),

    appendStreamingText: (chunk: string) => set((state: FlowState) => {
        // 如果 streaming 已被主动中断（用户点击了"新建对话"），则忽略后续的流式内容
        if ((state as any)._streamingAborted) {
            return state; // 不做任何改变
        }

        // Check if in select mode and source is locked
        const streamingMode = (state as any).streamingMode as StreamingMode | undefined;
        if (streamingMode === 'select') {
            // In select mode, only append if no source is locked yet
            // The actual source check happens in tryLockSource
        }

        return {
            streamingText: state.streamingText + chunk,
            isStreaming: true,
        };
    }),

    // 正常清理 streaming（开始新的 streaming 前调用）
    clearStreaming: () => set({
        streamingText: "",
        isStreaming: false,
        streamingMode: 'single',
        streamingSegments: [],
        lockedSourceId: null,
        selectSourceIds: [],
    } as any),

    // 主动中断 streaming（用户点击新建对话时调用）
    abortStreaming: () => set({
        streamingText: "",
        isStreaming: false,
        _streamingAborted: true,
        streamingMode: 'single',
        streamingSegments: [],
        lockedSourceId: null,
    } as any),

    // 重置中断标志（开始新的 streaming 前调用）
    resetStreamingAbort: () => set({ _streamingAborted: false } as any),

    // ===== Segmented Streaming for Merge Mode =====

    initSegmentedStreaming: (sourceIds: string[]) => {
        const segments: StreamSegment[] = sourceIds.map((id, index) => ({
            sourceId: id,
            content: '',
            status: index === 0 ? 'streaming' : 'waiting',
        }));

        set({
            streamingMode: 'segmented',
            streamingSegments: segments,
            streamingText: '',
            isStreaming: true,
        } as any);
    },

    appendToSegment: (sourceId: string, chunk: string) => set((state: FlowState) => {
        if ((state as any)._streamingAborted) return state;

        const segments = ((state as any).streamingSegments || []) as StreamSegment[];
        const segmentIndex = segments.findIndex(s => s.sourceId === sourceId);

        if (segmentIndex === -1) return state;

        const updatedSegments = [...segments];
        updatedSegments[segmentIndex] = {
            ...updatedSegments[segmentIndex],
            content: updatedSegments[segmentIndex].content + chunk,
            status: 'streaming',
        };

        // Also update streamingText for compatibility (concatenate all segments)
        const combinedText = updatedSegments
            .filter(s => s.content)
            .map(s => s.content)
            .join('\n\n');

        return {
            streamingSegments: updatedSegments,
            streamingText: combinedText,
        } as any;
    }),

    completeSegment: (sourceId: string) => set((state: FlowState) => {
        const segments = ((state as any).streamingSegments || []) as StreamSegment[];
        const segmentIndex = segments.findIndex(s => s.sourceId === sourceId);

        if (segmentIndex === -1) return state;

        const updatedSegments = [...segments];
        updatedSegments[segmentIndex] = {
            ...updatedSegments[segmentIndex],
            status: 'completed',
        };

        // Activate next waiting segment
        const nextWaiting = updatedSegments.findIndex(s => s.status === 'waiting');
        if (nextWaiting !== -1) {
            updatedSegments[nextWaiting] = {
                ...updatedSegments[nextWaiting],
                status: 'streaming',
            };
        }

        // Check if all segments are completed
        const allCompleted = updatedSegments.every(s => s.status === 'completed');

        return {
            streamingSegments: updatedSegments,
            isStreaming: !allCompleted,
        } as any;
    }),

    failSegment: (sourceId: string, error: string) => set((state: FlowState) => {
        const segments = ((state as any).streamingSegments || []) as StreamSegment[];
        const updatedSegments = segments.map(s => ({
            ...s,
            status: 'error' as const,
        }));

        return {
            streamingSegments: updatedSegments,
            isStreaming: false,
            _streamingError: `Segment ${sourceId} failed: ${error}`,
        } as any;
    }),

    // ===== Select Mode (First-Char Lock) =====

    initSelectStreaming: (sourceIds: string[]) => {
        set({
            streamingMode: 'select',
            selectSourceIds: sourceIds,
            lockedSourceId: null,
            streamingText: '',
            isStreaming: true,
        } as any);
    },

    tryLockSource: (sourceId: string): boolean => {
        const state = get() as any;

        // Already locked to a different source
        if (state.lockedSourceId && state.lockedSourceId !== sourceId) {
            return false;
        }

        // Check if this source is in the allowed list
        const selectSourceIds = state.selectSourceIds || [];
        if (selectSourceIds.length > 0 && !selectSourceIds.includes(sourceId)) {
            return false;
        }

        // Lock to this source
        if (!state.lockedSourceId) {
            set({ lockedSourceId: sourceId } as any);
        }

        return true;
    },
});

