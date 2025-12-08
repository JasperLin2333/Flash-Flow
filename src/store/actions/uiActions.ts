import { StateCreator } from "zustand";
import type { FlowState } from "@/types/flow";

export interface UIActions {
    setFlowTitle: (title: string) => void;
    setCurrentFlowId: (id: string | null) => void;
    setInteractionMode: (mode: "select" | "pan") => void;
    setAppMode: (isAppMode: boolean) => void;
    organizeNodes: () => void;
}

export const createUIActions: StateCreator<
    FlowState,
    [],
    [],
    UIActions
> = (set, get) => ({
    // ===== Simple State Setters =====
    setFlowTitle: (title: string) => {
        set({ flowTitle: title, saveStatus: "saving" });
        get().scheduleSave();
    },

    setCurrentFlowId: (id: string | null) => set({ currentFlowId: id }),

    setInteractionMode: (mode: "select" | "pan") => set({ interactionMode: mode }),

    setAppMode: (isAppMode: boolean) => set({ isAppMode }),

    // ===== Layout Actions =====
    organizeNodes: () => {
        const { nodes, edges } = get();
        // Dynamically import the layout algorithm to avoid issues
        import("../utils/layoutAlgorithm").then(({ calculateOptimalLayout }) => {
            const updatedNodes = calculateOptimalLayout(nodes, edges);
            set({ nodes: updatedNodes, saveStatus: "saving" });
            get().scheduleSave();
        });
    },
});
