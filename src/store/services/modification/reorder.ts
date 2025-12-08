import type { AppNode, AppEdge } from "@/types/flow";
import type { ModificationInstruction } from "./types";

const POSITION_OFFSET = 300;

/**
 * Execute 'reorder' modification instruction.
 */
export function executeModificationReorder(
    instruction: ModificationInstruction,
    nodes: AppNode[],
    edges: AppEdge[],
    setNodes: (nodes: AppNode[]) => void,
    setEdges: (edges: AppEdge[]) => void
): void {
    const { target, referenceNode, position } = instruction;

    // Find target and reference nodes
    const targetNodeObj = nodes.find(
        (n: AppNode) => n.id === target || n.data.label === target
    );
    const refNodeObj = nodes.find(
        (n: AppNode) => n.id === referenceNode || n.data.label === referenceNode
    );

    if (!targetNodeObj || !refNodeObj) {
        console.warn("Reorder: target or reference node not found");
        return;
    }

    // Update target node position
    const updatedNodes = nodes.map((n: AppNode) => {
        if (n.id === targetNodeObj.id) {
            return {
                ...n,
                position: {
                    x: refNodeObj.position.x + (position === "after" ? POSITION_OFFSET : -POSITION_OFFSET),
                    y: refNodeObj.position.y,
                },
            };
        }
        return n;
    });

    setNodes(updatedNodes);

    // Rewire edges (remove target node's old connections, rebuild based on new position)
    const newEdges = edges.filter(
        (e: AppEdge) => e.source !== targetNodeObj.id && e.target !== targetNodeObj.id
    );

    if (position === "after") {
        // refNode -> target
        newEdges.push({
            id: `e-${refNodeObj.id}-${targetNodeObj.id}`,
            source: refNodeObj.id,
            target: targetNodeObj.id,
        } as AppEdge);

        // Find refNode's original downstream, change it to target -> downstream
        const oldOutgoing = edges.find((e: AppEdge) => e.source === refNodeObj.id);
        if (oldOutgoing && oldOutgoing.target !== targetNodeObj.id) {
            newEdges.push({
                id: `e-${targetNodeObj.id}-${oldOutgoing.target}`,
                source: targetNodeObj.id,
                target: oldOutgoing.target,
            } as AppEdge);

            // Remove the original refNode -> downstream edge
            // Note: We need to filter it out from newEdges if we added it (we filtered target's edges but not ref's)
            // Actually we filtered target's edges. The refNode's edge is still there.
            const filteredEdges = newEdges.filter((e: AppEdge) => e.id !== oldOutgoing.id);
            setEdges(filteredEdges);
            return;
        }
    } else {
        // before: upstream -> target -> refNode
        const incomingEdge = edges.find((e: AppEdge) => e.target === refNodeObj.id);
        if (incomingEdge) {
            newEdges.push({
                id: `e-${incomingEdge.source}-${targetNodeObj.id}`,
                source: incomingEdge.source,
                target: targetNodeObj.id,
            } as AppEdge);
        }
        newEdges.push({
            id: `e-${targetNodeObj.id}-${refNodeObj.id}`,
            source: targetNodeObj.id,
            target: refNodeObj.id,
        } as AppEdge);
    }

    setEdges(newEdges);
}
