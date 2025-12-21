import type { AppNode, AppEdge, FlowState } from "@/types/flow";
import {
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type NodeChange,
    type EdgeChange,
    type Connection,
} from "@xyflow/react";
import { hasCycle } from "../utils/cycleDetection";

// Zustand store action creator types
type SetState = (partial: ((state: FlowState) => Partial<FlowState>) | Partial<FlowState>) => void;
type GetState = () => FlowState;

export const createEdgeActions = (set: SetState, get: GetState) => ({
    /**
     * 处理节点变更（位置、选中状态等）
     * 
     * PERFORMANCE FIX: Only trigger save for significant changes, not during drag
     * - Position changes during drag are applied but only saved on drag end
     * - Delete/add operations always trigger immediate save
     */
    onNodesChange: (changes: NodeChange[]) => {
        // 检查删除的节点并清理相关边
        const deletedNodeIds = changes
            .filter((c) => c.type === 'remove')
            .map((c) => c.id);

        if (deletedNodeIds.length > 0) {
            set((state: any) => ({
                nodes: applyNodeChanges(changes, state.nodes) as AppNode[],
                edges: state.edges.filter(
                    (e: AppEdge) => !deletedNodeIds.includes(e.source) && !deletedNodeIds.includes(e.target)
                ),
            }));
            // Deletion is a significant change - always save
            get().scheduleSave();
            return;
        }

        // Apply changes immediately for responsive UI
        set({ nodes: applyNodeChanges(changes, get().nodes) as AppNode[] });

        // PERFORMANCE: Check if any change requires saving
        // Position changes during dragging should NOT trigger save
        // Only save when:
        // 1. Position change is complete (type === 'position' && dragging === false)
        // 2. Other significant changes (dimensions, reset, etc.)
        const needsSave = changes.some((change) => {
            if (change.type === 'position') {
                // Only save when drag ends (dragging becomes false)
                return change.dragging === false;
            }
            // Other change types (add, remove already handled, dimensions, etc.) need save
            return change.type !== 'select'; // Selection changes don't need save
        });

        if (needsSave) {
            get().scheduleSave();
        }
    },

    /**
     * 处理边变更
     */
    onEdgesChange: (changes: EdgeChange[]) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
        get().scheduleSave();
    },

    /**
     * 连接两个节点（带循环检测）
     */
    onConnect: (connection: Connection) => {
        const { nodes, edges } = get();
        const src = nodes.find((n: AppNode) => n.id === connection.source);
        const tgt = nodes.find((n: AppNode) => n.id === connection.target);
        if (!src || !tgt) return;

        // 1. 自环检测
        if (connection.source === connection.target) {
            return;
        }

        // 2. 循环检测
        const tempEdges = addEdge(connection, edges);

        if (hasCycle(connection.target, nodes, tempEdges)) {
            return;
        }

        set({ edges: tempEdges });
        get().scheduleSave();
    },

    /**
     * 直接设置节点
     */
    setNodes: (nodes: AppNode[]) => set({ nodes }),

    /**
     * 直接设置边
     */
    setEdges: (edges: AppEdge[]) => set({ edges }),
});
