import { ensureInputOutputNodesAndEdges } from "@/lib/flowUtils";
import { safeFixWorkflowV1, type SafeFixOptions } from "@/lib/agent/safeFixV1";
import { validateGeneratedWorkflowV1_2 } from "@/lib/agent/generatedWorkflowValidatorV1";

type AnyNode = { id?: unknown; type?: unknown; data?: any };
type AnyEdge = { id?: unknown; source?: unknown; target?: unknown; sourceHandle?: unknown; [k: string]: unknown };

export interface DeterministicFixOptionsV1 {
  includeInputOutput?: boolean;
  safeFixOptions?: SafeFixOptions;
  onlyFixWhenInvalid?: boolean;
}

export interface DeterministicFixResultV1 {
  nodes: AnyNode[];
  edges: AnyEdge[];
  fixes: string[];
  findings: string[];
}

export function deterministicFixWorkflowV1(rawNodes: unknown, rawEdges: unknown, options?: DeterministicFixOptionsV1): DeterministicFixResultV1 {
  const includeInputOutput = options?.includeInputOutput === true;
  const onlyFixWhenInvalid = options?.onlyFixWhenInvalid ?? true;

  const inputNodes: AnyNode[] = Array.isArray(rawNodes) ? rawNodes : [];
  const inputEdges: AnyEdge[] = Array.isArray(rawEdges) ? rawEdges : [];

  const fixes: string[] = [];
  const findings: string[] = [];

  let nodes: AnyNode[] = JSON.parse(JSON.stringify(inputNodes));
  let edges: AnyEdge[] = JSON.parse(JSON.stringify(inputEdges));

  if (onlyFixWhenInvalid) {
    const report = validateGeneratedWorkflowV1_2(inputNodes, inputEdges);
    if (report.hardErrors.length === 0) {
      return { nodes, edges, fixes, findings };
    }
  }

  if (includeInputOutput) {
    const ensured = ensureInputOutputNodesAndEdges(nodes as any[], edges as any[]);
    nodes = ensured.nodes;
    edges = ensured.edges;
    fixes.push(...(ensured.fixes || []));
  }

  const inputNodeIds = nodes
    .filter((n) => String(n?.type || "") === "input")
    .map((n) => (typeof n?.id === "string" ? n.id : ""))
    .filter(Boolean);
  if (inputNodeIds.length === 1) {
    const inputId = inputNodeIds[0];
    let patched = 0;
    nodes = nodes.map((n) => {
      if (String(n?.type || "") !== "llm") return n;
      const data = n?.data || {};
      const rawMappings = data.inputMappings;
      const mappings =
        rawMappings && typeof rawMappings === "object" && !Array.isArray(rawMappings)
          ? (rawMappings as Record<string, unknown>)
          : {};
      const current = mappings.user_input;
      if (typeof current === "string" && current.trim().length > 0) return n;
      patched += 1;
      return {
        ...n,
        data: {
          ...data,
          inputMappings: { ...mappings, user_input: `{{${inputId}.user_input}}` },
        },
      };
    });
    if (patched > 0) {
      fixes.push(`为 ${patched} 个 LLM 节点补齐 inputMappings.user_input`);
    }
  }

  const fixed = safeFixWorkflowV1(nodes, edges, options?.safeFixOptions);
  fixes.push(...fixed.fixes);

  return { nodes: fixed.nodes, edges: fixed.edges, fixes, findings };
}
