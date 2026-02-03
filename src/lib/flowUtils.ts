
/**
 * 确保工作流包含 Input 和 Output 节点，并自动连接孤立节点
 */
export function ensureInputOutputNodesAndEdges(rawNodes: unknown[], rawEdges: unknown[]) {
  const nodes: any[] = Array.isArray(rawNodes) ? JSON.parse(JSON.stringify(rawNodes)) : [];
  const edges: any[] = Array.isArray(rawEdges) ? JSON.parse(JSON.stringify(rawEdges)) : [];

  const fixes: string[] = [];

  const usedIds = new Set<string>(nodes.map(n => n?.id).filter(Boolean));
  const usedLabels = new Set<string>(nodes.map(n => n?.data?.label).filter(Boolean));

  const uniqueId = (base: string) => {
    let id = base;
    let i = 1;
    while (usedIds.has(id)) {
      id = `${base}_${i}`;
      i++;
    }
    usedIds.add(id);
    return id;
  };

  const uniqueLabel = (base: string) => {
    let label = base;
    let i = 1;
    while (usedLabels.has(label)) {
      label = `${base}${i}`;
      i++;
    }
    usedLabels.add(label);
    return label;
  };

  const hasInput = nodes.some(n => n?.type === "input");
  const hasOutput = nodes.some(n => n?.type === "output");

  let inputId: string | null = null;
  let outputId: string | null = null;

  const guessOutputSource = () => {
    const candidates: Array<{ type: string; field: string }> = [
      { type: "llm", field: "response" },
      { type: "rag", field: "documents" },
      { type: "tool", field: "result" },
      { type: "imagegen", field: "imageUrl" },
      { type: "input", field: "user_input" },
    ];

    for (const c of candidates) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n?.type === c.type && typeof n?.id === "string" && n.id) {
          return `{{${n.id}.${c.field}}}`;
        }
      }
    }
    return "{{response}}";
  };

  if (!hasInput) {
    inputId = uniqueId("auto_input");
    nodes.unshift({ id: inputId, type: "input", data: { label: uniqueLabel("用户输入") } });
    fixes.push("已自动补齐 Input 节点");
  }

  if (!hasOutput) {
    outputId = uniqueId("auto_output");
    nodes.push({
      id: outputId,
      type: "output",
      data: {
        label: uniqueLabel("最终输出"),
        inputMappings: {
          mode: "select",
          sources: [{ type: "variable", value: guessOutputSource() }],
        },
      }
    });
    fixes.push("已自动补齐 Output 节点");
  }

  if (!inputId && !outputId) {
    return { nodes, edges, fixes };
  }

  const nodeIdSet = new Set<string>(nodes.map(n => n?.id).filter(Boolean));
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  const edgeKeySet = new Set<string>();
  edges
    .filter(e => nodeIdSet.has(e?.source) && nodeIdSet.has(e?.target))
    .forEach(e => {
      edgeKeySet.add(`${e.source}::${e.target}`);
    });

  const computeDegrees = () => {
    inDegree.clear();
    outDegree.clear();
    nodeIdSet.forEach(id => {
      inDegree.set(id, 0);
      outDegree.set(id, 0);
    });

    edges
      .filter(e => nodeIdSet.has(e?.source) && nodeIdSet.has(e?.target))
      .forEach(e => {
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
      });
  };

  computeDegrees();

  const getStartCandidates = () =>
    nodes
      .filter(n => n?.id && n.type !== "input" && n.type !== "output")
      .filter(n => (inDegree.get(n.id) || 0) === 0)
      .map(n => n.id);

  const getEndCandidates = () =>
    nodes
      .filter(n => n?.id && n.type !== "output")
      .filter(n => (outDegree.get(n.id) || 0) === 0)
      .map(n => n.id);

  if (inputId) {
    const startCandidates = getStartCandidates();
    for (const targetId of startCandidates) {
      const key = `${inputId}::${targetId}`;
      if (!edgeKeySet.has(key)) {
        edges.push({ source: inputId, target: targetId });
        edgeKeySet.add(key);
      }
    }
  }

  computeDegrees();

  if (outputId) {
    const endCandidates = getEndCandidates();
    for (const sourceId of endCandidates) {
      const key = `${sourceId}::${outputId}`;
      if (!edgeKeySet.has(key)) {
        edges.push({ source: sourceId, target: outputId });
        edgeKeySet.add(key);
      }
    }
  }

  return { nodes, edges, fixes };
}
