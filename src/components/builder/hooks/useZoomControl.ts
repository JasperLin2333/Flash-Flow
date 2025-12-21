/**
 * 缩放控制 Hook
 * 管理画布的缩放状态和操作
 */

import { useCallback } from "react";
import { useViewport } from "@xyflow/react";

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
  const { zoom } = useViewport();
  const zoomPct = Math.round(zoom * 100);

  /**
   * 放大
   */
  const handleZoomIn = useCallback(() => {
    reactFlow.zoomIn();
  }, [reactFlow]);

  /**
   * 缩小
   */
  const handleZoomOut = useCallback(() => {
    reactFlow.zoomOut();
  }, [reactFlow]);

  /**
   * 缩放到指定百分比
   */
  const handleZoomTo = useCallback(
    (pct: number) => {
      reactFlow.zoomTo(pct / 100, {
        duration: ZOOM_ANIMATION_DURATION,
      });
    },
    [reactFlow]
  );

  /**
   * 适配视图
   */
  const handleFitView = useCallback(() => {
    reactFlow.fitView();
  }, [reactFlow]);

  return {
    zoomPct,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    zoomTo: handleZoomTo,
    fitView: handleFitView,
  };
}
