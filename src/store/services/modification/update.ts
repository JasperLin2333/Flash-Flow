import type { AppNode } from "@/types/flow";
import type { ModificationInstruction } from "./types";

/**
 * Execute 'modify' modification instruction.
 */
export function executeModificationUpdate(
    instruction: ModificationInstruction,
    nodes: AppNode[],
    updateNodeData: (id: string, data: any) => void
): void {
    const { target, nodeData, changes } = instruction;

    // Find target node
    const targetNode = nodes.find(
        (n: AppNode) =>
            n.id === target || n.id.includes(target || "") || n.data.label === target
    );

    if (targetNode) {
        // Prefer nodeData, fallback to changes for backward compatibility
        const updateData = nodeData || changes;
        if (updateData) {
            updateNodeData(targetNode.id, updateData);
        }
    }
}
