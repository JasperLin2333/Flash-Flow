/**
 * Layout constants for canvas operations
 */

// Node placement constants
export const NODE_LAYOUT = {
    // Offset for creating new nodes when position is occupied
    AUTO_LAYOUT_OFFSET: 20,
    // Maximum iterations to find a free spot
    MAX_PLACEMENT_ITERATIONS: 20,
    // Threshold to consider a position "occupied"
    OVERLAP_THRESHOLD: 10,
    // Offset when pasting nodes from clipboard
    PASTE_OFFSET: 50,
} as const;
