import { nanoid } from "nanoid";
import type { AppNode, AppNodeData, NodeKind } from "@/types/flow";
import { getDefaultNodeData } from "../utils/nodeDefaults";

export const createNodeActions = (set: any, get: any) => ({
    /**
     * 添加新节点到画布
     * 自动检测位置冲突并应用偏移量以防止节点重叠
     */
    addNode: (type: NodeKind, position: { x: number; y: number }, data?: Partial<AppNodeData>) => {
        const OFFSET = 20; // 偏移量（像素）
        const MAX_ITERATIONS = 20; // 最大迭代次数防止无限循环
        const OVERLAP_THRESHOLD = 10; // 重叠阈值（像素）

        // 检查位置是否被占用并应用偏移
        let finalPosition = { ...position };
        let iterations = 0;

        while (iterations < MAX_ITERATIONS) {
            // 检查是否与现有节点重叠
            const overlap = get().nodes.some((node: AppNode) =>
                Math.abs(node.position.x - finalPosition.x) < OVERLAP_THRESHOLD &&
                Math.abs(node.position.y - finalPosition.y) < OVERLAP_THRESHOLD
            );

            if (!overlap) break;

            // 应用对角线偏移以创建层叠效果
            finalPosition = {
                x: finalPosition.x + OFFSET,
                y: finalPosition.y + OFFSET
            };
            iterations++;
        }

        // 创建节点并使用最终位置
        const id = `${type}-${nanoid(8)}`;
        const node: AppNode = {
            id,
            type,
            position: finalPosition,
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
