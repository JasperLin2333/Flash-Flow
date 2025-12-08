import type { NodeKind } from "@/types/flow";

export interface ModificationInstruction {
    action: "add" | "delete" | "modify" | "reorder";
    target?: string;    // The EXACT Node ID targeted
    position?: "before" | "after"; // For 'add' or 'reorder'
    nodeType?: NodeKind; // For 'add'

    // For 'add': Full node config
    // For 'modify': Only fields to update
    nodeData?: Record<string, any>;

    // For 'reorder': The reference node ID to move relative to
    referenceNode?: string;

    // 🆕 批量操作支持（添加分支时需要）
    additionalNodes?: Array<{
        nodeType: string;
        nodeData: any;
        connectFrom?: string;
    }>;
    additionalEdges?: Array<{
        source: string;
        target: string;
        sourceHandle?: "true" | "false";
    }>;

    // Deprecated: 保留向后兼容性
    changes?: Record<string, any>;
}
