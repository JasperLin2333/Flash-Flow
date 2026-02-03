import type { AppEdge, AppNode } from "@/types/flow";

type Fix = { edgeId: string; source: string; target: string; sourceHandle: "true" | "false" };

function getTargetY(nodeMap: Map<string, AppNode>, targetId: string): number | null {
  const node = nodeMap.get(targetId);
  const y = node?.position?.y;
  return typeof y === "number" && Number.isFinite(y) ? y : null;
}

function normalizeOutgoingOrder(nodeMap: Map<string, AppNode>, outgoing: AppEdge[]): AppEdge[] {
  return [...outgoing].sort((a, b) => {
    const ay = getTargetY(nodeMap, String(a.target));
    const by = getTargetY(nodeMap, String(b.target));
    if (ay !== null && by !== null && ay !== by) return ay - by;
    if (ay !== null && by === null) return -1;
    if (ay === null && by !== null) return 1;
    const at = String(a.target || "");
    const bt = String(b.target || "");
    if (at !== bt) return at.localeCompare(bt);
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

function getHandleValue(raw: unknown): "true" | "false" | null {
  if (raw === "true" || raw === "false") return raw;
  return null;
}

export function ensureBranchHandles(nodes: AppNode[], edges: AppEdge[]): { edges: AppEdge[]; fixes: Fix[] } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const fixes: Fix[] = [];
  const edgeById = new Map(edges.map((e) => [String(e.id), e]));
  const nextEdges = edges.map((e) => ({ ...e }));

  for (const node of nodes) {
    if (node.type !== "branch") continue;

    const outgoingIdx = nextEdges
      .map((e, idx) => ({ e, idx }))
      .filter((x) => x.e.source === node.id);

    if (outgoingIdx.length !== 2) continue;

    const e1 = outgoingIdx[0].e;
    const e2 = outgoingIdx[1].e;
    const h1 = getHandleValue((e1 as any).sourceHandle);
    const h2 = getHandleValue((e2 as any).sourceHandle);

    const hasExactPair = (h1 === "true" && h2 === "false") || (h1 === "false" && h2 === "true");
    if (hasExactPair) continue;

    if (h1 && !h2) {
      const desired = h1 === "true" ? "false" : "true";
      (e2 as any).sourceHandle = desired;
      fixes.push({ edgeId: String(e2.id), source: String(e2.source), target: String(e2.target), sourceHandle: desired });
      continue;
    }

    if (!h1 && h2) {
      const desired = h2 === "true" ? "false" : "true";
      (e1 as any).sourceHandle = desired;
      fixes.push({ edgeId: String(e1.id), source: String(e1.source), target: String(e1.target), sourceHandle: desired });
      continue;
    }

    const ordered = normalizeOutgoingOrder(nodeMap, [e1, e2]);
    const top = ordered[0];
    const bottom = ordered[1];

    (top as any).sourceHandle = "true";
    (bottom as any).sourceHandle = "false";
    fixes.push({ edgeId: String(top.id), source: String(top.source), target: String(top.target), sourceHandle: "true" });
    fixes.push({ edgeId: String(bottom.id), source: String(bottom.source), target: String(bottom.target), sourceHandle: "false" });
  }

  if (fixes.length === 0) {
    return { edges, fixes: [] };
  }

  const merged = nextEdges.map((e) => {
    const key = String(e.id);
    const original = edgeById.get(key);
    if (!original) return e;
    if ((original as any).sourceHandle === (e as any).sourceHandle) return original;
    return e;
  });

  return { edges: merged, fixes };
}

export function ensureBranchHandlesForNode(nodes: AppNode[], edges: AppEdge[], branchNodeId: string): { edges: AppEdge[]; fixes: Fix[] } {
  const branchNode = nodes.find((n) => n.id === branchNodeId && n.type === "branch");
  if (!branchNode) return { edges, fixes: [] };

  const outgoing = edges.filter((e) => e.source === branchNodeId);
  if (outgoing.length !== 2) return { edges, fixes: [] };

  const { edges: nextEdges, fixes } = ensureBranchHandles(nodes, edges);
  return { edges: nextEdges, fixes };
}

