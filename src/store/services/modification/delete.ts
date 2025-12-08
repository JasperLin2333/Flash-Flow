import type { AppNode, AppEdge } from "@/types/flow";
import type { ModificationInstruction } from "./types";

/**
 * Execute 'delete' modification instruction.
 */
export function executeModificationDelete(
    instruction: ModificationInstruction,
    nodes: AppNode[],
    edges: AppEdge[],
    setNodes: (nodes: AppNode[]) => void,
    setEdges: (edges: AppEdge[]) => void
): void {
    const { target } = instruction;

    // Find target node (supports ID, ID prefix, Label match)
    const targetNode = nodes.find(
        (n: AppNode) =>
            n.id === target || n.id.includes(target || "") || n.data.label === target
    );

    if (targetNode) {
        // Delete node and all connected edges
        setNodes(nodes.filter((n: AppNode) => n.id !== targetNode.id));
        setEdges(
            edges.filter(
                (e: AppEdge) =>
                    e.source !== targetNode.id && e.target !== targetNode.id
            )
        );
    }
}
