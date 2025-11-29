/**
 * 缩放控制 Hook
 * 管理画布的缩放状态和操作
 */

import { useCallback, useEffect, useState } from "react";
import type { ReactFlowInstance } from "@xyflow/react";

// ============ 常量 ============
export const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const;
export const ZOOM_TIMING = 150; // ms
export const ZOOM_ANIMATION_DURATION = 200; // ms

// ============ Hook ============
export interface UseZoomControlProps {
  zoomTo: (zoom: number, options: any) => void;
  getZoom: () => number;
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export function useZoomControl(reactFlow: UseZoomControlProps) {
  const [zoomPct, setZoomPct] = useState(100);

  /**
   * 刷新缩放百分比显示
   */
  const refreshZoom = useCallback(() => {
    setZoomPct(Math.round(reactFlow.getZoom() * 100));
  }, [reactFlow]);

  /**
   * 初始化缩放显示
   */
  useEffect(() => {
    refreshZoom();
    const id = setTimeout(refreshZoom, ZOOM_TIMING);
    return () => clearTimeout(id);
  }, [refreshZoom]);

  /**
   * 放大
   */
  const handleZoomIn = useCallback(() => {
    reactFlow.zoomIn();
    requestAnimationFrame(refreshZoom);
  }, [reactFlow, refreshZoom]);

  /**
   * 缩小
   */
  const handleZoomOut = useCallback(() => {
    reactFlow.zoomOut();
    requestAnimationFrame(refreshZoom);
  }, [reactFlow, refreshZoom]);

  /**
   * 缩放到指定百分比
   */
  const handleZoomTo = useCallback(
    (pct: number) => {
      reactFlow.zoomTo(pct / 100, {
        duration: ZOOM_ANIMATION_DURATION,
      });
      setTimeout(refreshZoom, ZOOM_ANIMATION_DURATION + 20);
    },
    [reactFlow, refreshZoom]
  );

  /**
   * 适配视图
   */
  const handleFitView = useCallback(() => {
    reactFlow.fitView();
    setTimeout(refreshZoom, ZOOM_TIMING);
  }, [reactFlow, refreshZoom]);

  return {
    zoomPct,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    zoomTo: handleZoomTo,
    fitView: handleFitView,
  };
}
