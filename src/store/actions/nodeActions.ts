import { nanoid } from "nanoid";
import type { AppNode, AppNodeData, NodeKind, FlowState } from "@/types/flow";
import { getDefaultNodeData } from "../utils/nodeDefaults";
import { toast } from "@/hooks/use-toast";
import { NODE_LAYOUT } from "../constants/layout";

// Zustand store action creator types
type SetState = (partial: ((state: FlowState) => Partial<FlowState>) | Partial<FlowState>) => void;
type GetState = () => FlowState;

export const createNodeActions = (set: SetState, get: GetState) => ({
    /**
     * 添加新节点到画布
     * 自动检测位置冲突并应用偏移量以防止节点重叠
     */
    addNode: (type: NodeKind, position: { x: number; y: number }, data?: Partial<AppNodeData>) => {
        // 检查 input 和 output 节点的单例限制
        const existingNodes = get().nodes as AppNode[];
        if (type === 'input') {
            const hasInputNode = existingNodes.some((node: AppNode) => node.type === 'input');
            if (hasInputNode) {
                toast({
                    variant: "warning",
                    title: "无法添加节点",
                    description: "每个画布只能有一个输入（Input）节点",
                });
                return;
            }
        }
        if (type === 'output') {
            const hasOutputNode = existingNodes.some((node: AppNode) => node.type === 'output');
            if (hasOutputNode) {
                toast({
                    variant: "warning",
                    title: "无法添加节点",
                    description: "每个画布只能有一个输出（Output）节点",
                });
                return;
            }
        }

        // 检查位置是否被占用并应用偏移
        let finalPosition = { ...position };
        let iterations = 0;

        while (iterations < NODE_LAYOUT.MAX_PLACEMENT_ITERATIONS) {
            // 检查是否与现有节点重叠
            const overlap = get().nodes.some((node: AppNode) =>
                Math.abs(node.position.x - finalPosition.x) < NODE_LAYOUT.OVERLAP_THRESHOLD &&
                Math.abs(node.position.y - finalPosition.y) < NODE_LAYOUT.OVERLAP_THRESHOLD
            );

            if (!overlap) break;

            // 应用对角线偏移以创建层叠效果
            finalPosition = {
                x: finalPosition.x + NODE_LAYOUT.AUTO_LAYOUT_OFFSET,
                y: finalPosition.y + NODE_LAYOUT.AUTO_LAYOUT_OFFSET
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
            return;
        }

        // 验证基于节点类型
        if (node.type === 'llm' && 'temperature' in data) {
            const temp = data.temperature as number;
            if (typeof temp === 'number' && (temp < 0 || temp > 1)) {
                return;
            }
        }

        if (node.type === 'rag' && 'files' in data) {
            const files = data.files as unknown;
            if (files && !Array.isArray(files)) {
                return;
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
