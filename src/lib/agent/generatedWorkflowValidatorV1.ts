import { extractVariables } from "@/lib/promptParser";
import type { NodeKind } from "@/types/flow";
import { HARD_ERROR_SPECS_V1_2, type ValidationIssue } from "./validationSpecV1";

type AnyNode = { id?: unknown; type?: unknown; data?: any };
type AnyEdge = { id?: unknown; source?: unknown; target?: unknown; sourceHandle?: unknown };

const hardMessageByCode = new Map(HARD_ERROR_SPECS_V1_2.map((s) => [s.code, s.message] as const));

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function makeHardIssue(code: string, location?: ValidationIssue["location"], hint?: string): ValidationIssue {
  return {
    code,
    severity: "hard",
    message: hardMessageByCode.get(code) || code,
    location,
    hint,
  };
}

function parseVariablePrefix(varName: string): string {
  const dotIndex = varName.indexOf(".");
  const bracketIndex = varName.indexOf("[");
  const cut = dotIndex === -1 ? bracketIndex : bracketIndex === -1 ? dotIndex : Math.min(dotIndex, bracketIndex);
  return (cut === -1 ? varName : varName.slice(0, cut)).trim();
}

function getStringFieldsToCheck(node: AnyNode): Array<{ fieldPath: string; value: string }> {
  const result: Array<{ fieldPath: string; value: string }> = [];
  const type = String(node.type || "");
  const data = node.data || {};

  const pushIfString = (fieldPath: string, v: unknown) => {
    if (typeof v === "string" && v.includes("{{") && v.includes("}}")) {
      result.push({ fieldPath, value: v });
    }
  };

  if (type === "llm") {
    pushIfString("data.systemPrompt", data.systemPrompt);
    const mappings = data.inputMappings;
    if (mappings && typeof mappings === "object") {
      for (const [k, v] of Object.entries(mappings)) {
        pushIfString(`data.inputMappings.${k}`, v);
      }
    }
  }

  if (type === "rag") {
    const mappings = data.inputMappings;
    if (mappings && typeof mappings === "object") {
      for (const [k, v] of Object.entries(mappings)) {
        pushIfString(`data.inputMappings.${k}`, v);
      }
    }
  }

  if (type === "tool") {
    const inputs = data.inputs;
    if (inputs && typeof inputs === "object") {
      for (const [k, v] of Object.entries(inputs)) {
        pushIfString(`data.inputs.${k}`, v);
      }
    }
  }

  if (type === "output") {
    const im = data.inputMappings || {};
    pushIfString("data.inputMappings.template", im.template);
    const sources = Array.isArray(im.sources) ? im.sources : [];
    sources.forEach((s: any, i: number) => pushIfString(`data.inputMappings.sources[${i}].value`, s?.value));
    const attachments = Array.isArray(im.attachments) ? im.attachments : [];
    attachments.forEach((a: any, i: number) => pushIfString(`data.inputMappings.attachments[${i}].value`, a?.value));
  }

  if (type === "branch") {
    pushIfString("data.condition", data.condition);
  }

  if (type === "imagegen") {
    pushIfString("data.prompt", data.prompt);
    pushIfString("data.negativePrompt", data.negativePrompt);
    pushIfString("data.referenceImageVariable", data.referenceImageVariable);
    pushIfString("data.referenceImage2Variable", data.referenceImage2Variable);
    pushIfString("data.referenceImage3Variable", data.referenceImage3Variable);
  }

  return result;
}

function detectCycle(nodeIds: string[], edges: Array<{ source: string; target: string }>): boolean {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) adj.get(e.source)?.push(e.target);

  const visited = new Set<string>();
  const stack = new Set<string>();

  const dfs = (id: string): boolean => {
    visited.add(id);
    stack.add(id);
    for (const next of adj.get(id) || []) {
      if (!visited.has(next)) {
        if (dfs(next)) return true;
      } else if (stack.has(next)) {
        return true;
      }
    }
    stack.delete(id);
    return false;
  };

  for (const id of nodeIds) {
    if (!visited.has(id) && dfs(id)) return true;
  }
  return false;
}

function isValidFormFieldName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function toNodeKind(value: string): NodeKind | null {
  const v = value.toLowerCase();
  if (v === "input" || v === "llm" || v === "rag" || v === "output" || v === "branch" || v === "tool" || v === "imagegen") return v as NodeKind;
  if (v === "imagegen" || v === "image_gen" || v === "image") return "imagegen";
  return null;
}

export interface GeneratedWorkflowValidationResult {
  hardErrors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateGeneratedWorkflowV1_2(rawNodes: unknown, rawEdges: unknown): GeneratedWorkflowValidationResult {
  const hardErrors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) {
    hardErrors.push(makeHardIssue("FFV-SCHEMA-002"));
    return { hardErrors, warnings };
  }
  if (rawNodes.length === 0) {
    hardErrors.push(makeHardIssue("FFV-SCHEMA-001"));
    return { hardErrors, warnings };
  }

  const nodes = rawNodes as AnyNode[];
  const edges = rawEdges as AnyEdge[];

  const nodeIds: string[] = [];
  const nodeIdSet = new Set<string>();
  const nodeIdLowerSet = new Set<string>();
  const nodeTypeById = new Map<string, string>();
  const nodeLabelById = new Map<string, string>();
  const labelNormToIds = new Map<string, string[]>();
  const kindCount = new Map<NodeKind, number>();

  for (const node of nodes) {
    const id = typeof node?.id === "string" ? node.id : "";
    const type = typeof node?.type === "string" ? node.type : "";
    if (!id || !type) {
      hardErrors.push(makeHardIssue("FFV-NODE-001"));
      continue;
    }
    if (/\s/.test(id)) {
      hardErrors.push(makeHardIssue("FFV-NODE-001", { nodeId: id }, "节点 id 不能包含空白字符"));
      continue;
    }
    if (nodeIdSet.has(id)) {
      hardErrors.push(makeHardIssue("FFV-NODE-002", { nodeId: id }));
      continue;
    }
    nodeIdSet.add(id);
    nodeIdLowerSet.add(id.toLowerCase());
    nodeIds.push(id);
    nodeTypeById.set(id, type);

    const label = typeof node?.data?.label === "string" ? node.data.label : "";
    if (!label.trim()) {
      hardErrors.push(makeHardIssue("FFV-NODE-003", { nodeId: id, fieldPath: "data.label" }));
    } else {
      nodeLabelById.set(id, label);
      const norm = normalizeLabel(label);
      const list = labelNormToIds.get(norm) || [];
      list.push(id);
      labelNormToIds.set(norm, list);
    }

    const kind = toNodeKind(type);
    if (kind) kindCount.set(kind, (kindCount.get(kind) || 0) + 1);
  }

  for (const [norm, ids] of labelNormToIds.entries()) {
    if (norm.startsWith("node_") || norm.startsWith("edge_") || norm.startsWith("auto_")) {
      for (const id of ids) {
        hardErrors.push(makeHardIssue("FFV-NODE-005", { nodeId: id, fieldPath: "data.label" }));
      }
    }
    if (ids.length > 1) {
      hardErrors.push(makeHardIssue("FFV-NODE-004", { nodeId: ids[0], fieldPath: "data.label" }));
    }
  }

  const hasInput = nodes.some((n) => String(n?.type || "") === "input");
  const hasOutput = nodes.some((n) => String(n?.type || "") === "output");
  if (!hasInput) hardErrors.push(makeHardIssue("FFV-GRAPH-001"));
  if (!hasOutput) hardErrors.push(makeHardIssue("FFV-GRAPH-002"));

  const normalizedEdges: Array<{ source: string; target: string; sourceHandle?: unknown }> = [];
  for (const edge of edges) {
    const source = typeof edge?.source === "string" ? edge.source : "";
    const target = typeof edge?.target === "string" ? edge.target : "";
    const id = typeof edge?.id === "string" ? edge.id : undefined;
    if (!source || !target) {
      hardErrors.push(makeHardIssue("FFV-EDGE-001", { edgeId: id }));
      continue;
    }
    if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) {
      hardErrors.push(makeHardIssue("FFV-EDGE-002", { edgeId: id }));
      continue;
    }
    normalizedEdges.push({ source, target, sourceHandle: edge.sourceHandle });

    const sourceType = nodeTypeById.get(source) || "";
    if (sourceType === "branch") {
      const sh = edge.sourceHandle;
      if (!(sh === "true" || sh === "false")) {
        hardErrors.push(makeHardIssue("FFV-BRANCH-001", { edgeId: id, nodeId: source, fieldPath: "sourceHandle" }));
      }
    } else {
      const sh = edge.sourceHandle;
      if (!(sh === null || sh === undefined)) {
        hardErrors.push(makeHardIssue("FFV-BRANCH-002", { edgeId: id, nodeId: source, fieldPath: "sourceHandle" }));
      }
    }
  }

  for (const node of nodes) {
    const id = typeof node?.id === "string" ? node.id : "";
    const type = typeof node?.type === "string" ? node.type : "";
    const data = node?.data || {};
    if (!id || !type) continue;

    if (type === "llm") {
      if (data?.model !== undefined && typeof data.model !== "string") {
        hardErrors.push(makeHardIssue("FFV-LLM-001", { nodeId: id, fieldPath: "data.model" }, "model 必须是字符串"));
      }
      if (data?.systemPrompt !== undefined && typeof data.systemPrompt !== "string") {
        hardErrors.push(makeHardIssue("FFV-LLM-001", { nodeId: id, fieldPath: "data.systemPrompt" }, "systemPrompt 必须是字符串"));
      }
      const llmInput = data?.inputMappings?.user_input;
      if (typeof llmInput !== "string" || llmInput.trim().length === 0) {
        hardErrors.push(makeHardIssue("FFV-LLM-002", { nodeId: id, fieldPath: "data.inputMappings.user_input" }, "LLM 节点必须配置 inputMappings.user_input"));
      }
      if (data?.temperature !== undefined) {
        const temp = data.temperature;
        if (typeof temp !== "number" || Number.isNaN(temp) || temp < 0 || temp > 1) {
          hardErrors.push(makeHardIssue("FFV-LLM-001", { nodeId: id, fieldPath: "data.temperature" }, "temperature 必须是 0-1 之间的数字"));
        }
      }
      if (data?.responseFormat !== undefined) {
        if (!(data.responseFormat === "text" || data.responseFormat === "json_object")) {
          hardErrors.push(makeHardIssue("FFV-LLM-001", { nodeId: id, fieldPath: "data.responseFormat" }, 'responseFormat 只能是 "text" 或 "json_object"'));
        }
      }
    }

    if (type === "tool") {
      if (!data?.toolType) {
        hardErrors.push(makeHardIssue("FFV-TOOL-001", { nodeId: id }));
      }
    }

    if (type === "rag") {
      const im = data?.inputMappings;
      const queryOk = typeof im?.query === "string" && im.query.trim().length > 0;
      const hasAnyFilesMapping = Boolean(im?.files || im?.files2 || im?.files3);
      const storeName = typeof data?.fileSearchStoreName === "string" ? data.fileSearchStoreName.trim() : "";
      const fileMode = typeof data?.fileMode === "string" ? data.fileMode : "";
      const effectiveFileMode = fileMode || (storeName ? "static" : hasAnyFilesMapping ? "variable" : "");

      const ok =
        queryOk &&
        (effectiveFileMode === "variable"
          ? hasAnyFilesMapping
          : effectiveFileMode === "static"
            ? storeName.length > 0
            : false);

      if (!ok) {
        hardErrors.push(makeHardIssue("FFV-RAG-001", { nodeId: id }));
      }
    }

    if (type === "branch") {
      if (!data?.condition) {
        hardErrors.push(makeHardIssue("FFV-BRANCH-001", { nodeId: id, fieldPath: "data.condition" }, "Branch 节点必须配置 condition"));
      }
    }

    if (type === "output") {
      const im = data?.inputMappings;
      const mode = im?.mode;
      if (!im || !mode) {
        hardErrors.push(makeHardIssue("FFV-OUTPUT-001", { nodeId: id }));
      } else if (!(mode === "direct" || mode === "select" || mode === "merge" || mode === "template")) {
        hardErrors.push(makeHardIssue("FFV-OUTPUT-001", { nodeId: id, fieldPath: "data.inputMappings.mode" }, "Output.mode 不合法"));
      } else {
        const sources = Array.isArray(im.sources) ? im.sources : [];
        if (mode === "template") {
          if (typeof im.template !== "string" || !im.template.trim()) {
            hardErrors.push(makeHardIssue("FFV-OUTPUT-002", { nodeId: id, fieldPath: "data.inputMappings.template" }));
          }
        } else if (mode === "direct") {
          if (sources.length !== 1) {
            hardErrors.push(makeHardIssue("FFV-OUTPUT-002", { nodeId: id, fieldPath: "data.inputMappings.sources" }, "direct 模式必须配置且只能配置一个来源"));
          }
        } else if (mode === "select" || mode === "merge") {
          if (sources.length < 1) {
            hardErrors.push(makeHardIssue("FFV-OUTPUT-002", { nodeId: id, fieldPath: "data.inputMappings.sources" }));
          }
        }
      }
    }

    if (type === "input") {
      if (data?.enableStructuredForm === true) {
        const fields = Array.isArray(data?.formFields) ? data.formFields : [];
        if (fields.length === 0) {
          hardErrors.push(makeHardIssue("FFV-INPUT-001", { nodeId: id, fieldPath: "data.formFields" }, "启用结构化表单时必须配置 formFields"));
        } else {
          for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (!isValidFormFieldName(field?.name)) {
              hardErrors.push(makeHardIssue("FFV-INPUT-001", { nodeId: id, fieldPath: `data.formFields[${i}].name` }));
              break;
            }
          }
        }
      }
      if (data?.enableFileInput === true) {
        if (data?.enableTextInput === false) {
          hardErrors.push(makeHardIssue("FFV-INPUT-001", { nodeId: id, fieldPath: "data.enableTextInput" }, "启用文件上传时必须启用文本输入"));
        }
        if (data?.textRequired !== true) {
          hardErrors.push(makeHardIssue("FFV-INPUT-001", { nodeId: id, fieldPath: "data.textRequired" }, "启用文件上传时文本必须为必填 (textRequired=true)"));
        }
        const fc = data?.fileConfig;
        const ok =
          fc &&
          Array.isArray(fc.allowedTypes) &&
          fc.allowedTypes.length > 0 &&
          typeof fc.maxSizeMB === "number" &&
          typeof fc.maxCount === "number";
        if (!ok) {
          hardErrors.push(makeHardIssue("FFV-INPUT-001", { nodeId: id, fieldPath: "data.fileConfig" }, "启用文件上传时必须配置 fileConfig"));
        }
      }
    }
  }

  if (normalizedEdges.length > 0 && detectCycle(nodeIds, normalizedEdges)) {
    hardErrors.push(makeHardIssue("FFV-GRAPH-003"));
  }

  const incomingByTarget = new Map<string, AnyEdge[]>();
  for (const e of normalizedEdges) {
    const list = incomingByTarget.get(e.target) || [];
    list.push(e);
    incomingByTarget.set(e.target, list);
  }

  for (const [targetId, incoming] of incomingByTarget.entries()) {
    const targetType = nodeTypeById.get(targetId) || "";
    if (targetType === "output") continue;

    const byBranchSource = new Map<string, Set<string>>();
    for (const e of incoming) {
      const sourceId = typeof e.source === "string" ? e.source : "";
      if (!sourceId) continue;
      const srcType = nodeTypeById.get(sourceId) || "";
      if (srcType !== "branch") continue;
      const handles = byBranchSource.get(sourceId) || new Set<string>();
      if (e.sourceHandle === "true" || e.sourceHandle === "false") handles.add(String(e.sourceHandle));
      byBranchSource.set(sourceId, handles);
    }

    for (const [branchId, handles] of byBranchSource.entries()) {
      if (handles.has("true") && handles.has("false")) {
        hardErrors.push(makeHardIssue("FFV-BRANCH-003", { nodeId: targetId }, `互斥分支不应在非 Output 节点汇聚（来源分支: ${branchId}）`));
        break;
      }
    }
  }

  const labelNormSet = new Set(Array.from(labelNormToIds.keys()));
  const idToLabelNorm = new Map<string, string>();
  for (const [id, label] of nodeLabelById.entries()) {
    idToLabelNorm.set(id, normalizeLabel(label));
  }

  for (const node of nodes) {
    const nodeId = typeof node?.id === "string" ? node.id : "";
    const fields = getStringFieldsToCheck(node);
    if (!nodeId || fields.length === 0) continue;

    for (const { fieldPath, value } of fields) {
      const vars = extractVariables(value);
      for (const varName of vars) {
        const prefix = parseVariablePrefix(varName);
        if (!prefix) continue;
        const prefixNorm = normalizeLabel(prefix);

        if (labelNormSet.has(prefixNorm)) continue;

        const asKind = toNodeKind(prefix);
        if (asKind && (kindCount.get(asKind) || 0) === 1) continue;

        const isNodeId = nodeIdSet.has(prefix) || nodeIdLowerSet.has(prefix.toLowerCase());
        if (isNodeId) continue;
        hardErrors.push(makeHardIssue("FFV-VAR-001", { nodeId, fieldPath }));
      }
    }
  }

  return { hardErrors, warnings };
}
