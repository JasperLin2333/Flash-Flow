import { nanoid } from "nanoid";
import type { AppNode, AppNodeData, NodeKind } from "@/types/flow";
import { getDefaultNodeData } from "../utils/nodeDefaults";

export const createNodeActions = (set: any, get: any) => ({
    /**
     * 添加新节点到画布
     */
    addNode: (type: NodeKind, position: { x: number; y: number }, data?: Partial<AppNodeData>) => {
        const id = `${type}-${nanoid(8)}`;
        const node: AppNode = {
            id,
            type,
            position,
            data: { label: type.toUpperCase(), status: "idle", ...(data || {}) }
        };
        set({ nodes: [...get().nodes, node] });
        set({ selectedNodeId: id });
        get().scheduleSave();
    },

    /**
     * 更新节点数据
     */
    updateNodeData: (id: string, data: Partial<AppNodeData>) => {
        const node = get().nodes.find((n: AppNode) => n.id === id);
        if (!node) {
            console.error(`Node ${id} not found`);
            return;
        }

        // 验证基于节点类型
        if (node.type === 'llm' && 'temperature' in data) {
            const temp = data.temperature as number;
            if (typeof temp === 'number' && (temp < 0 || temp > 1)) {
                console.error('Invalid temperature: must be between 0 and 1');
                return;
            }
        }

        if (node.type === 'rag' && 'files' in data) {
            const files = data.files as unknown;
            if (files && !Array.isArray(files)) {
                console.error('Invalid files: must be an array');
                return;
            }
        }

        if (node.type === 'http' && 'url' in data) {
            const url = data.url as string;
            if (url && typeof url === 'string' && url !== '') {
                try {
                    new URL(url);
                } catch {
                    console.error('Invalid URL format');
                    return;
                }
            }
        }

        set({
            nodes: get().nodes.map((n: AppNode) =>
                n.id === id ? { ...n, data: { ...(n.data || {}), ...data } } : n
            ),
            saveStatus: "saving",
        });
        get().scheduleSave();
    },

    /**
     * 重置节点数据为默认值
     */
    resetNodeData: (id: string) => {
        const node = get().nodes.find((n: AppNode) => n.id === id);
        if (!node) return;

        const defaults = getDefaultNodeData(node.type as NodeKind);

        set({
            nodes: get().nodes.map((n: AppNode) =>
                n.id === id ? { ...n, data: defaults } : n
            ),
            saveStatus: "saving",
        });
        get().scheduleSave();
    },

    /**
     * 设置选中的节点
     */
    setSelectedNode: (id: string | null) => set({ selectedNodeId: id }),
});
