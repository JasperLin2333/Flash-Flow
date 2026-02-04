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
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

// 生产环境安全配置
const PROD_CONFIG = {
  batch_size: 20,  // 生产环境增大批次减少请求
  flush_interval: 10000,  // 延长上报间隔
  sample_rate: 0.1,  // 增加采样率减少数据量
};

// 高频事件采样率配置
const HIGH_FREQ_EVENTS = ['canvas_pan', 'canvas_zoom', 'node_hover', 'edge_hover'];
// 开发环境 5%，生产环境 10%（更保守）
const SAMPLE_RATE = IS_PRODUCTION ? PROD_CONFIG.sample_rate : 0.05;

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

    // 生产环境不输出调试日志
    if (DEBUG_MODE) {
        console.log('[Track]', eventName, eventData);
    } else if (IS_PRODUCTION) {
        // 生产环境只记录错误，不记录具体事件数据
        // 避免敏感信息泄露
    }

    eventQueue.push(event);

    // 使用环境特定的配置
    const batchSize = IS_PRODUCTION ? PROD_CONFIG.batch_size : BATCH_SIZE;
    const flushInterval = IS_PRODUCTION ? PROD_CONFIG.flush_interval : FLUSH_INTERVAL_MS;

    // 达到批量阈值立即刷新
    if (eventQueue.length >= batchSize) {
        flushEvents();
    } else if (!flushTimer) {
        // 启动定时刷新
        flushTimer = setTimeout(flushEvents, flushInterval);
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

    // 更新 sessionStorage 中的 userId 以供 beforeunload 使用
    if (userId && typeof window !== 'undefined') {
        sessionStorage.setItem('tracking_user_id', userId);
    }

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
            // 从 sessionStorage 获取已保存的用户 ID（由 flushEvents 异步更新或登录时设置）
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

export const trackNodeDataUpdate = (nodeId: string, nodeType: string, field: string) =>
    track('node_data_update', { node_id: nodeId, node_type: nodeType, field });

export const trackEdgeConnect = (source: string, target: string) =>
    track('edge_connect', { source, target });

export const trackEdgeDelete = (edgeId: string) =>
    track('edge_delete', { edge_id: edgeId });

export const trackCanvasMove = (x: number, y: number, zoom: number) =>
    track('canvas_pan', { x: Math.round(x), y: Math.round(y), zoom: Number(zoom.toFixed(2)) });

export const trackSelectionChange = (nodeCount: number, edgeCount: number) =>
    track('selection_change', { node_count: nodeCount, edge_count: edgeCount });

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

// ============ 补充的画布交互埋点 ============

// 节点悬停（配合 createHoverTracker 使用）
export const trackNodeHover = (nodeId: string, nodeType: string, duration: number) =>
    track('node_hover', { node_id: nodeId, node_type: nodeType, duration });

// 连线悬停
export const trackEdgeHover = (edgeId: string, source: string, target: string, duration: number) =>
    track('edge_hover', { edge_id: edgeId, source, target, duration });

// 节点双击
export const trackNodeDoubleClick = (nodeId: string, nodeType: string) =>
    track('node_double_click', { node_id: nodeId, node_type: nodeType });

// 画布点击（空白区域）
export const trackCanvasClick = () =>
    track('canvas_click', {});

// 节点拖拽开始
export const trackNodeDragStart = (nodeId: string, nodeType: string) =>
    track('node_drag_start', { node_id: nodeId, node_type: nodeType });

// 节点拖拽结束
export const trackNodeDragEnd = (nodeId: string, nodeType: string, startPos: { x: number; y: number }, endPos: { x: number; y: number }) =>
    track('node_drag_end', { 
        node_id: nodeId, 
        node_type: nodeType,
        start_x: Math.round(startPos.x),
        start_y: Math.round(startPos.y),
        end_x: Math.round(endPos.x),
        end_y: Math.round(endPos.y),
        distance: Math.round(Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2)))
    });

// 画布右键菜单
export const trackCanvasContextMenu = (position: { x: number; y: number }) =>
    track('canvas_context_menu', { x: Math.round(position.x), y: Math.round(position.y) });

// 节点右键菜单
export const trackNodeContextMenu = (nodeId: string, nodeType: string) =>
    track('node_context_menu', { node_id: nodeId, node_type: nodeType });

// 多选操作
export const trackMultiSelect = (nodeIds: string[], edgeIds: string[]) =>
    track('multi_select', { 
        node_count: nodeIds.length, 
        edge_count: edgeIds.length,
        node_ids: nodeIds,
        edge_ids: edgeIds
    });

// 节点复制粘贴
export const trackNodeCopy = (nodeIds: string[], nodeTypes: string[]) =>
    track('node_copy', { node_ids: nodeIds, node_types: nodeTypes });

export const trackNodePaste = (nodeCount: number) =>
    track('node_paste', { node_count: nodeCount });

// 节点对齐操作
export const trackNodeAlign = (alignment: string, nodeCount: number) =>
    track('node_align', { alignment, node_count: nodeCount });

// 节点分布操作
export const trackNodeDistribute = (distribution: string, nodeCount: number) =>
    track('node_distribute', { distribution, node_count: nodeCount });

// 自动布局使用
export const trackAutoLayout = (algorithm: string, nodeCount: number) =>
    track('auto_layout', { algorithm, node_count: nodeCount });

// 导入/导出操作
export const trackFlowImport = (source: string, nodeCount: number, edgeCount: number) =>
    track('flow_import', { source, node_count: nodeCount, edge_count: edgeCount });

export const trackFlowExport = (format: string, nodeCount: number, edgeCount: number) =>
    track('flow_export', { format, node_count: nodeCount, edge_count: edgeCount });

// 搜索功能使用
export const trackNodeSearch = (queryLength: number, resultCount: number) =>
    track('node_search', { query_length: queryLength, result_count: resultCount });

// 撤销/重做操作
export const trackUndo = (actionType: string) =>
    track('undo', { action_type: actionType });

export const trackRedo = (actionType: string) =>
    track('redo', { action_type: actionType });

// ============ Network Diagnostics ============
export const trackNetworkDiagnostic = (data: Record<string, unknown>) =>
    track('network_diagnostic', data);

export const trackAgentFailNetwork = (error: string, metrics: Record<string, unknown>) =>
    track('agent_fail_network', { error, ...metrics });

/**
 * 运行简单的网络诊断并返回结果
 */
export async function runQuickDiagnostic() {
    try {
        const start = performance.now();
        const resp = await fetch("/api/health", { method: "HEAD", cache: "no-cache" });
        const latency = performance.now() - start;

        // 获取地理位置信息（可选）
        let geo = {};
        try {
            const geoResp = await fetch("https://api.ip.sb/geoip", { cache: 'no-cache' });
            geo = await geoResp.json();
        } catch {
            // Ignore geo errors
        }

        return {
            latency,
            status: resp.status,
            ok: resp.ok,
            ...geo,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        return {
            error: e instanceof Error ? e.message : String(e),
            timestamp: new Date().toISOString()
        };
    }
}
