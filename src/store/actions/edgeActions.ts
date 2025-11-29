import type { AppNode, AppEdge } from "@/types/flow";
import {
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type NodeChange,
    type EdgeChange,
    type Connection,
} from "@xyflow/react";
import { hasCycle } from "../utils/cycleDetection";

export const createEdgeActions = (set: any, get: any) => ({
    /**
     * 处理节点变更（位置、选中状态等）
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
        } else {
            set({ nodes: applyNodeChanges(changes, get().nodes) as AppNode[] });
        }
        get().scheduleSave();
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
            console.warn("Cannot connect node to itself");
            return;
        }

        // 2. 循环检测
        const tempEdges = addEdge(connection, edges);

        if (hasCycle(connection.target, nodes, tempEdges)) {
            console.error("Cycle detected! Connection rejected.");
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
