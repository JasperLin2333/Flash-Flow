import type { AppEdge, AppNode, AppNodeData } from "@/types/flow";

function stripRuntimeNodeData(data: AppNodeData): AppNodeData {
  const record = (data ?? {}) as Record<string, unknown>;
  const {
    status: _status,
    executionTime: _executionTime,
    output: _output,
    ...rest
  } = record;

  return { ...(rest as AppNodeData), status: "idle" };
}

function stripInputRuntimeData(data: AppNodeData): AppNodeData {
  const record = (data ?? {}) as Record<string, unknown>;
  const {
    text: _text,
    files: _files,
    formData: _formData,
    ...rest
  } = record;
  return rest as AppNodeData;
}

export function sanitizeFlowForSave(nodes: AppNode[], edges: AppEdge[]): { nodes: AppNode[]; edges: AppEdge[] } {
  const sanitizedNodes = nodes.map((n) => {
    const base = stripRuntimeNodeData(n.data as AppNodeData);
    const data = n.type === "input" ? stripInputRuntimeData(base) : base;
    return { ...n, data };
  });

  return { nodes: sanitizedNodes, edges };
}

