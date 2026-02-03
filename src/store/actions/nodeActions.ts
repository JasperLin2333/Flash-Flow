import { nanoid } from "nanoid";
import type { AppNode, AppNodeData, NodeKind, FlowState, LLMNodeData, BranchNodeData, ImageGenNodeData, OutputNodeData } from "@/types/flow";
import { getDefaultNodeData } from "../utils/nodeDefaults";
import { toast } from "@/hooks/use-toast";
import { NODE_LAYOUT } from "../constants/layout";
import { trackNodeAdd, trackNodeDataUpdate } from "@/lib/trackingService";

// Zustand store action creator types
type SetState = (partial: ((state: FlowState) => Partial<FlowState>) | Partial<FlowState>) => void;
type GetState = () => FlowState;

/**
 * Escape regex special characters
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update variable references in all nodes when a node label changes.
 * Replaces {{oldLabel.xxx}} with {{newLabel.xxx}} in all relevant fields.
 * 
 * @param nodes - All nodes in the flow
 * @param oldLabel - The old node label
 * @param newLabel - The new node label
 * @returns Updated nodes array
 */
function updateVariableReferences(
    nodes: AppNode[],
    oldLabel: string,
    newLabel: string
): AppNode[] {
    // Create regex to match {{oldLabel.xxx}} pattern
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(oldLabel)}\\.`, 'g');
    const replacement = `{{${newLabel}.`;

    const replaceInString = (str: string | undefined): string | undefined => {
        if (!str) return str;
        return str.replace(pattern, replacement);
    };

    return nodes.map(node => {
        const nodeType = node.type;
        let updated = false;
        const newData = { ...node.data };

        // LLM node: systemPrompt, inputMappings.user_input
        if (nodeType === 'llm') {
            const llmData = newData as LLMNodeData;
            const newSystemPrompt = replaceInString(llmData.systemPrompt);
            if (newSystemPrompt !== llmData.systemPrompt) {
                (newData as LLMNodeData).systemPrompt = newSystemPrompt || '';
                updated = true;
            }
            // inputMappings
            const inputMappings = (newData as Record<string, unknown>).inputMappings as Record<string, string> | undefined;
            if (inputMappings?.user_input) {
                const newUserInput = replaceInString(inputMappings.user_input);
                if (newUserInput !== inputMappings.user_input) {
                    (newData as Record<string, unknown>).inputMappings = {
                        ...inputMappings,
                        user_input: newUserInput
                    };
                    updated = true;
                }
            }
        }

        // RAG node: inputMappings.query, inputMappings.files
        if (nodeType === 'rag') {
            const inputMappings = (newData as Record<string, unknown>).inputMappings as Record<string, string> | undefined;
            if (inputMappings) {
                let ragUpdated = false;
                const updatedMappings = { ...inputMappings };
                if (inputMappings.query) {
                    const newQuery = replaceInString(inputMappings.query);
                    if (newQuery !== inputMappings.query) {
                        updatedMappings.query = newQuery || '';
                        ragUpdated = true;
                    }
                }
                if (inputMappings.files) {
                    const newFiles = replaceInString(inputMappings.files);
                    if (newFiles !== inputMappings.files) {
                        updatedMappings.files = newFiles || '';
                        ragUpdated = true;
                    }
                }
                if (ragUpdated) {
                    (newData as Record<string, unknown>).inputMappings = updatedMappings;
                    updated = true;
                }
            }
        }

        // Branch node: condition
        if (nodeType === 'branch') {
            const branchData = newData as BranchNodeData;
            const newCondition = replaceInString(branchData.condition);
            if (newCondition !== branchData.condition) {
                (newData as BranchNodeData).condition = newCondition || '';
                updated = true;
            }
        }

        // ImageGen node: prompt, negativePrompt, referenceImageVariable
        if (nodeType === 'imagegen') {
            const imgData = newData as ImageGenNodeData;
            const newPrompt = replaceInString(imgData.prompt);
            if (newPrompt !== imgData.prompt) {
                (newData as ImageGenNodeData).prompt = newPrompt || '';
                updated = true;
            }
            const newNegPrompt = replaceInString(imgData.negativePrompt);
            if (newNegPrompt !== imgData.negativePrompt) {
                (newData as ImageGenNodeData).negativePrompt = newNegPrompt;
                updated = true;
            }
            const newRefVar = replaceInString(imgData.referenceImageVariable);
            if (newRefVar !== imgData.referenceImageVariable) {
                (newData as ImageGenNodeData).referenceImageVariable = newRefVar;
                updated = true;
            }
        }

        // Output node: inputMappings.sources[].value, inputMappings.template, inputMappings.attachments[].value
        if (nodeType === 'output') {
            const outputData = newData as OutputNodeData;
            const inputMappings = outputData.inputMappings;
            if (inputMappings) {
                let outputUpdated = false;
                const updatedMappings = { ...inputMappings };

                // Update template
                if (inputMappings.template) {
                    const newTemplate = replaceInString(inputMappings.template);
                    if (newTemplate !== inputMappings.template) {
                        updatedMappings.template = newTemplate;
                        outputUpdated = true;
                    }
                }

                // Update sources
                if (inputMappings.sources && inputMappings.sources.length > 0) {
                    const newSources = inputMappings.sources.map(source => {
                        const newValue = replaceInString(source.value);
                        if (newValue !== source.value) {
                            outputUpdated = true;
                            return { ...source, value: newValue || '' };
                        }
                        return source;
                    });
                    if (outputUpdated) {
                        updatedMappings.sources = newSources;
                    }
                }

                // Update attachments
                if (inputMappings.attachments && inputMappings.attachments.length > 0) {
                    const newAttachments = inputMappings.attachments.map(att => {
                        const newValue = replaceInString(att.value);
                        if (newValue !== att.value) {
                            outputUpdated = true;
                            return { ...att, value: newValue || '' };
                        }
                        return att;
                    });
                    if (outputUpdated) {
                        updatedMappings.attachments = newAttachments;
                    }
                }

                if (outputUpdated) {
                    (newData as OutputNodeData).inputMappings = updatedMappings;
                    updated = true;
                }
            }
        }

        return updated ? { ...node, data: newData } : node;
    });
}

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
        // 使用 getDefaultNodeData 获取节点类型的默认值，然后与传入的 data 合并
        const id = `${type}-${nanoid(8)}`;
        const defaults = getDefaultNodeData(type);
        const node: AppNode = {
            id,
            type,
            position: finalPosition,
            data: {
                ...defaults,
                label: (data?.label as string) || defaults.label || type.toUpperCase(),
                status: "idle",
                ...(data || {})
            }
        };
        set({ nodes: [...get().nodes, node] });
        set({ selectedNodeId: id });
        get().scheduleSave();

        // 埋点：节点添加
        trackNodeAdd(type, finalPosition);
    },

    /**
     * 更新节点数据
     */
    updateNodeData: (id: string, data: Partial<AppNodeData>) => {
        const nodes = get().nodes;
        const node = nodes.find((n: AppNode) => n.id === id);
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

        // 检测 Label 变更，自动更新其他节点的变量引用
        const oldLabel = node.data?.label as string | undefined;
        const newLabel = data.label as string | undefined;
        const isLabelChanged = newLabel && oldLabel && newLabel !== oldLabel;

        let updatedNodes = nodes.map((n: AppNode) =>
            n.id === id ? { ...n, data: { ...(n.data || {}), ...data } } : n
        );

        // 如果 Label 变更，更新所有引用该节点的变量
        if (isLabelChanged) {
            updatedNodes = updateVariableReferences(updatedNodes, oldLabel, newLabel);
        }

        // 埋点：数据更新
        // 记录更新的主要字段名
        const updatedFields = Object.keys(data);
        if (updatedFields.length > 0) {
            trackNodeDataUpdate(id, node.type || 'unknown', updatedFields[0]);
        }

        set({
            nodes: updatedNodes,
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
