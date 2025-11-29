/**
 * Z-Index Scale for Flash Flow
 * Centralized z-index values to prevent conflicts and maintain consistent layering
 */

export const Z_INDEX = {
    // Base canvas layer
    CANVAS: 0,

    // UI control layers
    CONTROLS: 10,
    HUD: 20,

    // Modal and overlay layers
    MODAL: 50,
    COPILOT_OVERLAY: 100,

    // Notification layers
    TOAST: 200,
    TOOLTIP: 300,
} as const;

export type ZIndex = typeof Z_INDEX[keyof typeof Z_INDEX];
