/**
 * TrackingService - 用户行为埋点核心模块
 * 
 * 功能：
 * - track(eventName, eventData) - 主追踪函数
 * - 本地事件队列 + 批量上报（每 5 秒或满 10 条）
 * - 高频事件采样（canvas_pan, node_hover 等 5% 采样）
 * - 悬浮事件防抖（≥300ms 才上报）
 */

import { supabase } from './supabase';

// ============ Config ============
const DEBUG_MODE = process.env.NODE_ENV === 'development';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

// 高频事件采样率（5%）
const HIGH_FREQ_EVENTS = ['canvas_pan', 'canvas_zoom', 'node_hover', 'edge_hover'];
const SAMPLE_RATE = 0.05;

// ============ Types ============
interface TrackingEvent {
    event_name: string;
    event_data: Record<string, unknown>;
    page: string;
    created_at: string;
}

// ============ State ============
let eventQueue: TrackingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sessionId: string | null = null;

// 生成或获取 session ID
function getSessionId(): string {
    if (sessionId) return sessionId;

    // 尝试从 sessionStorage 恢复
    if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('tracking_session_id');
        if (stored) {
            sessionId = stored;
            return sessionId;
        }
        // 生成新的 session ID
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem('tracking_session_id', sessionId);
    } else {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
    return sessionId;
}

// 获取当前用户 ID
async function getUserId(): Promise<string | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id || null;
    } catch {
        return null;
    }
}

// ============ Core Track Function ============
export function track(eventName: string, eventData: Record<string, unknown> = {}): void {
    // 高频事件采样
    if (HIGH_FREQ_EVENTS.includes(eventName)) {
        if (Math.random() > SAMPLE_RATE) {
            return; // 跳过本次上报
        }
    }

    const event: TrackingEvent = {
        event_name: eventName,
        event_data: eventData,
        page: typeof window !== 'undefined' ? window.location.pathname : '',
        created_at: new Date().toISOString(),
    };

    if (DEBUG_MODE) {
        console.log('[Track]', eventName, eventData);
    }

    eventQueue.push(event);

    // 达到批量阈值立即刷新
    if (eventQueue.length >= BATCH_SIZE) {
        flushEvents();
    } else if (!flushTimer) {
        // 启动定时刷新
        flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL_MS);
    }
}

// ============ Batch Flush ============
async function flushEvents(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    if (eventQueue.length === 0) return;

    const eventsToSend = [...eventQueue];
    eventQueue = [];

    const userId = await getUserId();
    const sid = getSessionId();

    const records = eventsToSend.map(e => ({
        user_id: userId,
        session_id: sid,
        event_name: e.event_name,
        event_data: e.event_data as unknown as import('@/types/database').Json,
        page: e.page,
        created_at: e.created_at,
    }));

    try {
        const { error } = await supabase.from('user_events').insert(records);
        if (error) {
            console.error('[TrackingService] Failed to flush events:', error);
            // 失败时将事件放回队列（最多保留 50 条防止内存溢出）
            eventQueue = [...eventsToSend.slice(-20), ...eventQueue].slice(-50);
        } else if (DEBUG_MODE) {
            console.log(`[TrackingService] Flushed ${records.length} events`);
        }
    } catch (err) {
        console.error('[TrackingService] Network error:', err);
        eventQueue = [...eventsToSend.slice(-20), ...eventQueue].slice(-50);
    }
}

// ============ Hover Tracking (Debounced) ============
const HOVER_THRESHOLD_MS = 300;

export function createHoverTracker(
    eventName: string,
    eventData: Record<string, unknown> = {}
): { onEnter: () => void; onLeave: () => void } {
    let enterTime: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onEnter = () => {
        enterTime = Date.now();
        timer = setTimeout(() => {
            // 超过阈值后上报
            track(eventName, { ...eventData, hover_duration: HOVER_THRESHOLD_MS });
        }, HOVER_THRESHOLD_MS);
    };

    const onLeave = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        // 如果停留超过阈值，计算实际时长
        if (enterTime && Date.now() - enterTime >= HOVER_THRESHOLD_MS) {
            const duration = Date.now() - enterTime;
            track(eventName, { ...eventData, hover_duration: duration });
        }
        enterTime = null;
    };

    return { onEnter, onLeave };
}

// ============ Page Unload Handling ============
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        // 使用 sendBeacon 确保页面关闭时事件不丢失
        if (eventQueue.length > 0) {
            const userId = sessionStorage.getItem('tracking_user_id');
            const sid = getSessionId();

            const records = eventQueue.map(e => ({
                user_id: userId,
                session_id: sid,
                event_name: e.event_name,
                event_data: e.event_data,
                page: e.page,
                created_at: e.created_at,
            }));

            // sendBeacon 是同步的，适合 unload 场景
            const blob = new Blob([JSON.stringify({ records })], { type: 'application/json' });
            navigator.sendBeacon('/api/track-beacon', blob);
        }
    });
}

// ============ Convenience Exports ============
export const trackNodeAdd = (nodeType: string, position?: { x: number; y: number }) =>
    track('node_add', { node_type: nodeType, position });

export const trackNodeDelete = (nodeId: string, nodeType: string) =>
    track('node_delete', { node_id: nodeId, node_type: nodeType });

export const trackNodeSelect = (nodeId: string, nodeType: string) =>
    track('node_select', { node_id: nodeId, node_type: nodeType });

export const trackEdgeConnect = (source: string, target: string) =>
    track('edge_connect', { source, target });

export const trackEdgeDelete = (edgeId: string) =>
    track('edge_delete', { edge_id: edgeId });

export const trackWorkflowRun = (nodeCount: number, edgeCount: number) =>
    track('workflow_run', { node_count: nodeCount, edge_count: edgeCount });

export const trackWorkflowRunSuccess = (duration: number) =>
    track('workflow_run_success', { duration_ms: duration });

export const trackWorkflowRunFail = (errorType: string, failedNode?: string) =>
    track('workflow_run_fail', { error_type: errorType, failed_node: failedNode });

export const trackAgentStart = (mode: string, inputLength: number) =>
    track('agent_start', { mode, input_length: inputLength });

export const trackAgentComplete = (stepCount: number, duration: number) =>
    track('agent_complete', { step_count: stepCount, duration_ms: duration });

export const trackCopilotPlanConfirm = (stepCount: number) =>
    track('copilot_plan_confirm', { step_count: stepCount });

export const trackCopilotPlanAdjust = () =>
    track('copilot_plan_adjust', {});

export const trackKeyboardShortcut = (shortcutKey: string, action: string) =>
    track('keyboard_shortcut', { shortcut_key: shortcutKey, action });
