import { nanoid } from "nanoid";
import type { AppNode, FlowState } from "@/types/flow";
import { toast } from "@/hooks/use-toast";
import { NODE_LAYOUT } from "../constants/layout";

// Zustand store action creator types
type SetState = (partial: ((state: FlowState) => Partial<FlowState>) | Partial<FlowState>) => void;
type GetState = () => FlowState;

/**
 * 剪贴板操作 - 处理节点的复制和粘贴
 */
export const createClipboardActions = (set: SetState, get: GetState) => ({
    /**
     * 复制当前选中的节点到剪贴板
     */
    copyNode: () => {
        const { selectedNodeId, nodes } = get();
        if (!selectedNodeId) return;

        const node = nodes.find((n: AppNode) => n.id === selectedNodeId);
        if (!node) return;

        // 深拷贝节点数据到剪贴板
        set({ clipboard: JSON.parse(JSON.stringify(node)) });
    },

    /**
     * 从剪贴板粘贴节点到画布
     * 新节点会在原节点位置偏移一定距离
     */
    pasteNode: () => {
        const { clipboard, nodes } = get();
        if (!clipboard) return;

        // 检查 input 和 output 节点的单例限制
        const nodeType = clipboard.type;
        if (nodeType === 'input') {
            const hasInputNode = nodes.some((node: AppNode) => node.type === 'input');
            if (hasInputNode) {
                toast({
                    variant: "warning",
                    title: "无法粘贴节点",
                    description: "每个画布只能有一个输入（Input）节点",
                });
                return;
            }
        }
        if (nodeType === 'output') {
            const hasOutputNode = nodes.some((node: AppNode) => node.type === 'output');
            if (hasOutputNode) {
                toast({
                    variant: "warning",
                    title: "无法粘贴节点",
                    description: "每个画布只能有一个输出（Output）节点",
                });
                return;
            }
        }

        // 创建新的节点 ID
        const newId = `${clipboard.type}-${nanoid(8)}`;

        // 计算新位置（原位置 + 偏移）
        const newPosition = {
            x: clipboard.position.x + NODE_LAYOUT.PASTE_OFFSET,
            y: clipboard.position.y + NODE_LAYOUT.PASTE_OFFSET,
        };

        // 创建新节点，复制数据但使用新 ID 和新位置
        // 创建新节点，确保它处于选中状态
        const newNode: AppNode = {
            ...clipboard,
            id: newId,
            position: newPosition,
            selected: true, // 只有新节点被选中
            data: {
                ...clipboard.data,
                // 重置执行状态
                status: "idle",
                output: undefined,
                executionTime: undefined,
            },
        };

        // 取消选中所有现有节点
        const updatedNodes = nodes.map((n: AppNode) => ({
            ...n,
            selected: false,
        }));

        // 更新剪贴板中的位置，以便连续粘贴时位置递增
        set({
            nodes: [...updatedNodes, newNode],
            selectedNodeId: newId,
            clipboard: {
                ...clipboard,
                position: newPosition,
            },
        });

        get().scheduleSave();
    },
});
