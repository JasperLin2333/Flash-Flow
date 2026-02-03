import { StateCreator } from "zustand";
import { flowAPI } from "@/services/flowAPI";
import type { FlowState } from "@/types/flow";
import { showWarning } from "@/utils/errorNotify";
import { sanitizeFlowForSave } from "@/store/utils/flowPersistence";

// Module-level timer for debounce
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export interface SaveActions {
    scheduleSave: () => Promise<string | null>;
    flushSave: () => Promise<string | null>;
    setFlowIcon: (kind?: "emoji" | "lucide" | "image", name?: string, url?: string) => void;
}

export const createSaveActions: StateCreator<
    FlowState,
    [],
    [],
    SaveActions
> = (set, get) => ({
    // ===== Persistence =====
    /**
     * CRITICAL FIX: Schedule a debounced save operation
     * 
     * TIMING: Returns a Promise that resolves when save completes (after 800ms debounce)
     * This allows callers to await the completion and get the flowId
     * 
     * RACE CONDITION FIX: Previously this was async () => void, causing race conditions
     * where dependent code tried to read currentFlowId before save completed.
     * 
     * @returns Promise<string | null> - The saved flow ID, or null if save failed
     */
    scheduleSave: (): Promise<string | null> => {
        // Clear any pending save timer
        if (saveTimer) clearTimeout(saveTimer);

        set({ saveStatus: "saving" });

        // ASYNC CHAIN: Return a promise that resolves after debounce + save
        return new Promise((resolve) => {
            saveTimer = setTimeout(async () => {
                try {
                    const currentState = get();
                    const data = sanitizeFlowForSave(currentState.nodes, currentState.edges);
                    const title = currentState.flowTitle || "Untitled Flow";

                    // WHY: autoSave returns the flowId (either existing or newly created)
                    const id = await flowAPI.autoSave(
                        currentState.currentFlowId,
                        title,
                        data
                    );

                    set({ currentFlowId: id, saveStatus: "saved" });
                    resolve(id);
                } catch {
                    set({ saveStatus: "saved" }); // Reset status even on error
                    showWarning("保存失败", "自动保存失败，请手动保存或稍后重试");
                    resolve(null); // FIX: Resolve with null instead of rejecting, don't break the flow
                }
            }, 800);
        });
    },

    /**
     * CRITICAL FIX: Immediately save without debounce
     * 
     * WHY: For critical operations like copilot completion, we need the flowId immediately
     * to update the URL. Can't wait for the 800ms debounce.
     * 
     * USE CASE: After generating a flow, we need the ID right away to update URL
     * 
     * @returns Promise<string | null> - The saved flow ID, or null if save failed
     */
    flushSave: async (): Promise<string | null> => {
        // TIMING: Cancel any pending debounced save
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }

        set({ saveStatus: "saving" });

        try {
            const currentState = get();
            const data = sanitizeFlowForSave(currentState.nodes, currentState.edges);
            const title = currentState.flowTitle || "Untitled Flow";

            // WHY: Immediate save, no debounce
            const id = await flowAPI.autoSave(
                currentState.currentFlowId,
                title,
                data
            );

            set({ currentFlowId: id, saveStatus: "saved" });
            return id;
        } catch {
            set({ saveStatus: "saved" });
            showWarning("保存失败", "保存失败，请稍后重试");
            return null;
        }
    },

    setFlowIcon: (kind?: "emoji" | "lucide" | "image", name?: string, url?: string) => {
        set({ flowIconKind: kind, flowIconName: name, flowIconUrl: url });
    },
});
