import { nanoid } from "nanoid";
import type { AppNode, AppEdge, NodeKind } from "@/types/flow";
import type { ModificationInstruction } from "./types";

const DEFAULT_NODE_POSITION = { x: 320, y: 240 };
// Increase offset to avoid overlap
const POSITION_OFFSET = 300;

// ============ Helper Functions ============

function calculateNewNodePosition(
    targetNode: AppNode | undefined,
    position: "before" | "after" | undefined
) {
    return targetNode
        ? {
            x: targetNode.position.x + (position === "after" ? POSITION_OFFSET : -POSITION_OFFSET),
            y: targetNode.position.y,
        }
        : DEFAULT_NODE_POSITION;
}

function createMainNode(
    newId: string,
    nodeType: NodeKind,
    newPos: { x: number; y: number },
    nodeData: any
): AppNode {
    return {
        id: newId,
        type: nodeType,
        position: newPos,
        data: {
            label: nodeType.toUpperCase(),
            status: "idle",
            ...nodeData,
        },
    };
}

/**
 * Process additional nodes (e.g., for branches) and add them to the list.
 * Returns updated idMapping.
 */
function processAdditionalNodes(
    instruction: ModificationInstruction,
    newPos: { x: number; y: number },
    idMapping: Record<string, string>,
    allNewNodes: AppNode[]
): void {
    const { additionalNodes } = instruction;
    if (!additionalNodes || additionalNodes.length === 0) return;

    let offsetY = 0;
    additionalNodes.forEach((addNode, idx) => {
        const addId = `${addNode.nodeType}-${nanoid(8)}`;
        idMapping[addNode.nodeType + "_" + idx] = addId;
        if (addNode.connectFrom) {
            idMapping[addNode.connectFrom] = addId;
        }

        // Branch scenario: true path up, false path down
        offsetY = idx === 0 ? -100 : 100;

        const addNodeObj: AppNode = {
            id: addId,
            type: addNode.nodeType as NodeKind,
            position: {
                x: newPos.x + POSITION_OFFSET,
                y: newPos.y + offsetY,
            },
            data: {
                label: addNode.nodeType.toUpperCase(),
                status: "idle",
                ...addNode.nodeData,
            },
        };
        allNewNodes.push(addNodeObj);
    });
}

function updateEdgesForAdd(
    nodes: AppNode[],
    edges: AppEdge[],
    instruction: ModificationInstruction,
    targetNode: AppNode | undefined,
    newId: string,
    newEdges: AppEdge[]
): AppEdge[] {
    const { target, position, nodeType, additionalEdges } = instruction;

    if (targetNode && position) {
        if (position === "after") {
            // Insert after target: target -> new -> oldTarget
            newEdges.push({
                id: `e-${targetNode.id}-${newId}`,
                source: targetNode.id,
                target: newId,
            } as AppEdge);

            // Find existing edge from target node to re-wire
            const oldEdge = edges.find((e: AppEdge) => e.source === targetNode.id);
            if (oldEdge) {
                // First remove the old edge to prevent duplicates
                // Note: we filter from the localized newEdges array which started as a copy of edges
                // However, we need to return the modified array. 
                // Using filter here is safe as long as we re-assign.
                const filtered = newEdges.filter((e: AppEdge) => e.id !== oldEdge.id);

                // Then add the new edge from new node to old target
                filtered.push({
                    id: `e-${newId}-${oldEdge.target}`,
                    source: newId,
                    target: oldEdge.target,
                } as AppEdge);

                // Update newEdges reference
                // (But wait, we are inside a function, we must return the result)
                // Let's just return the new array at the end.
                return filtered;
            }
        } else {
            // Insert before target: oldSource -> new -> target
            const incomingEdge = edges.find((e: AppEdge) => e.target === target);
            if (incomingEdge) {
                newEdges.push({
                    id: `e-${incomingEdge.source}-${newId}`,
                    source: incomingEdge.source,
                    target: newId,
                } as AppEdge);
                newEdges.push({
                    id: `e-${newId}-${target}`,
                    source: newId,
                    target,
                } as AppEdge);
                return newEdges.filter((e: AppEdge) => e.id !== incomingEdge.id);
            }
        }
    } else {
        // Fallback: No target/position, try to connect to Output
        const outputNode = nodes.find((n: AppNode) => n.type === "output");
        const lastLLM = nodes.filter((n: AppNode) => n.type === "llm").pop();

        if (lastLLM) {
            // Insert after last LLM
            newEdges.push({
                id: `e-${lastLLM.id}-${newId}`,
                source: lastLLM.id,
                target: newId,
            } as AppEdge);

            if (outputNode) {
                // Re-connect to Output
                const filtered = newEdges.filter((e: AppEdge) => !(e.source === lastLLM.id && e.target === outputNode.id));
                filtered.push({
                    id: `e-${newId}-${outputNode.id}`,
                    source: newId,
                    target: outputNode.id,
                } as AppEdge);
                return filtered;
            }
        }
    }
    return newEdges;
}

function processAdditionalEdges(
    instruction: ModificationInstruction,
    nodes: AppNode[],
    allNewNodes: AppNode[],
    idMapping: Record<string, string>,
    newEdges: AppEdge[],
    newId: string
): void {
    const { additionalEdges, nodeType } = instruction;
    if (!additionalEdges || additionalEdges.length === 0) return;

    additionalEdges.forEach((edge) => {
        // Parse source/target (might be placeholders or real IDs)
        let sourceId = edge.source;
        let targetId = edge.target;

        // Replace placeholders
        if (sourceId === "branch" || sourceId === nodeType) sourceId = newId;
        if (targetId === "branch" || targetId === nodeType) targetId = newId;

        // Try finding in idMapping
        if (idMapping[sourceId]) sourceId = idMapping[sourceId];
        if (idMapping[targetId]) targetId = idMapping[targetId];

        // Try finding in existing nodes
        const srcNode = nodes.find((n: AppNode) => n.id === sourceId || n.data.label === sourceId);
        const tgtNode = [...nodes, ...allNewNodes].find((n: AppNode) => n.id === targetId || n.data.label === targetId);

        if (srcNode) sourceId = srcNode.id;
        if (tgtNode) targetId = tgtNode.id;

        const newEdge: AppEdge = {
            id: `e-${sourceId}-${targetId}-${nanoid(4)}`,
            source: sourceId,
            target: targetId,
        };

        if (edge.sourceHandle) {
            newEdge.sourceHandle = edge.sourceHandle;
        }

        newEdges.push(newEdge);
    });
}

// ============ Main Export ============

/**
 * Execute 'add' modification instruction.
 * Supports single node and batch addition (e.g. branch with paths).
 */
export function executeModificationAdd(
    instruction: ModificationInstruction,
    nodes: AppNode[],
    edges: AppEdge[],
    setNodes: (nodes: AppNode[]) => void,
    setEdges: (edges: AppEdge[]) => void
): void {
    const { target, nodeType, nodeData, position } = instruction;

    if (!nodeType) return;

    // Find target node
    const targetNode = nodes.find(
        (n: AppNode) => n.id === target || n.data.label === target
    );

    // Generate new ID and position
    const newId = `${nodeType}-${nanoid(8)}`;
    const newPos = calculateNewNodePosition(targetNode, position);

    // Create main node
    const newNode = createMainNode(newId, nodeType, newPos, nodeData);

    // Collect all new nodes
    let allNewNodes: AppNode[] = [newNode];
    const idMapping: Record<string, string> = {};
    idMapping[nodeType] = newId;
    idMapping["branch"] = newId; // Shortcut

    // Process additional nodes
    processAdditionalNodes(instruction, newPos, idMapping, allNewNodes);

    // Add all new nodes
    setNodes([...nodes, ...allNewNodes]);

    // Handle edge connections
    let newEdges = [...edges];

    // 1. Basic wiring (inserting main node)
    newEdges = updateEdgesForAdd(nodes, newEdges, instruction, targetNode, newId, newEdges);

    // 2. Additional internal wiring (e.g. branch paths)
    processAdditionalEdges(instruction, nodes, allNewNodes, idMapping, newEdges, newId);

    setEdges(newEdges);
}
