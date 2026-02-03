import { nanoid } from "nanoid";
import type { AppNode, FlowData, FormFieldConfig, NodeKind } from "@/types/flow";
import { ensureBranchHandles } from "@/lib/branchHandleUtils";

const DEFAULT_FILE_CONFIG = { allowedTypes: ["*/*"], maxSizeMB: 100, maxCount: 10 };
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function sanitizeVariableName(input: string): string {
  let s = input.trim();
  s = s.replace(/[^\w]/g, "_");
  s = s.replace(/_+/g, "_");
  if (!s) return "";
  if (!/^[a-zA-Z_]/.test(s)) s = `_${s}`;
  if (!FIELD_NAME_RE.test(s)) {
    s = s.replace(/^[^a-zA-Z_]+/, "_").replace(/[^\w]/g, "_").replace(/_+/g, "_");
  }
  return s;
}

function makeUnique(base: string, used: Set<string>): string {
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${i++}`;
  }
  used.add(candidate);
  return candidate;
}

function normalizeFormFields(raw: unknown): { formFields: FormFieldConfig[] } {
  const used = new Set<string>();
  const fields = Array.isArray(raw) ? raw : [];
  const normalized: FormFieldConfig[] = [];

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i] as any;
    const type = (f?.type === "select" || f?.type === "text" || f?.type === "multi-select") ? f.type : "text";
    const label = typeof f?.label === "string" && f.label.trim() ? f.label : `字段${i + 1}`;
    const rawName = typeof f?.name === "string" ? f.name : "";
    const baseNameCandidate = sanitizeVariableName(rawName) || sanitizeVariableName(label) || `field_${nanoid(6)}`;
    const name = makeUnique(baseNameCandidate, used);
    const required = Boolean(f?.required);

    if (type === "select") {
      const options = Array.isArray(f?.options) && f.options.length > 0 ? f.options.map(String) : ["选项1", "选项2"];
      const defaultValue = typeof f?.defaultValue === "string" ? f.defaultValue : undefined;
      normalized.push({ type: "select", name, label, options, required, defaultValue });
      continue;
    }

    if (type === "multi-select") {
      const options = Array.isArray(f?.options) && f.options.length > 0 ? f.options.map(String) : ["选项1", "选项2"];
      const defaultValue = Array.isArray(f?.defaultValue) ? f.defaultValue.map(String) : undefined;
      normalized.push({ type: "multi-select", name, label, options, required, defaultValue });
      continue;
    }

    const placeholder = typeof f?.placeholder === "string" ? f.placeholder : undefined;
    const defaultValue = typeof f?.defaultValue === "string" ? f.defaultValue : undefined;
    normalized.push({ type: "text", name, label, placeholder, required, defaultValue });
  }

  return { formFields: normalized };
}

function normalizeInputNode(node: AppNode): AppNode {
  const data = (node.data ?? {}) as Record<string, unknown>;

  const enableTextInput = data.enableTextInput !== false;
  const textRequired = enableTextInput && data.textRequired === true;
  const enableFileInput = data.enableFileInput === true;
  const enableStructuredForm = data.enableStructuredForm === true;
  const fileRequired = enableFileInput && data.fileRequired === true;

  const fileConfig =
    enableFileInput
      ? {
          allowedTypes: Array.isArray((data.fileConfig as any)?.allowedTypes) && (data.fileConfig as any).allowedTypes.length > 0
            ? (data.fileConfig as any).allowedTypes.map(String)
            : DEFAULT_FILE_CONFIG.allowedTypes,
          maxSizeMB: typeof (data.fileConfig as any)?.maxSizeMB === "number" ? (data.fileConfig as any).maxSizeMB : DEFAULT_FILE_CONFIG.maxSizeMB,
          maxCount: typeof (data.fileConfig as any)?.maxCount === "number" ? (data.fileConfig as any).maxCount : DEFAULT_FILE_CONFIG.maxCount,
        }
      : undefined;

  const { formFields: normalizedFields } = normalizeFormFields(data.formFields);
  const formFields =
    enableStructuredForm && normalizedFields.length === 0
      ? [{ type: "text", name: `field_${nanoid(6)}`, label: "参数", required: false, defaultValue: "" } as FormFieldConfig]
      : normalizedFields;

  const greeting = typeof data.greeting === "string" ? data.greeting : "";
  const label = typeof data.label === "string" ? data.label : "输入";

  const nextData: Record<string, unknown> = {
    ...data,
    label,
    status: "idle",
    enableTextInput,
    textRequired,
    enableFileInput,
    enableStructuredForm,
    fileRequired,
    fileConfig,
    formFields,
    greeting,
  };

  delete nextData.executionTime;
  delete nextData.output;
  delete nextData.text;
  delete nextData.files;
  delete nextData.formData;

  return { ...node, data: nextData as any };
}

function normalizeBranchNode(node: AppNode): AppNode {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const label = typeof data.label === "string" ? data.label : "分支";
  const rawCondition = typeof data.condition === "string" ? data.condition : "";

  const nextData: Record<string, unknown> = {
    ...data,
    label,
    status: "idle",
    condition: rawCondition.trim() ? rawCondition : "true",
  };

  delete nextData.executionTime;
  delete nextData.output;

  return { ...node, data: nextData as any };
}

function normalizeGenericNode(node: AppNode): AppNode {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const nextData: Record<string, unknown> = { ...data, status: "idle" };
  delete nextData.executionTime;
  delete nextData.output;
  return { ...node, data: nextData as any };
}

export function normalizeLoadedFlowData(flowData: FlowData): FlowData {
  const nodesRaw = Array.isArray(flowData?.nodes) ? flowData.nodes : [];
  const edgesRaw = Array.isArray(flowData?.edges) ? flowData.edges : [];

  const nodes = nodesRaw.map((n) => {
    const node = n as AppNode;
    const type = node?.type as NodeKind | undefined;
    if (type === "input") return normalizeInputNode(node);
    if (type === "branch") return normalizeBranchNode(node);
    return normalizeGenericNode(node);
  });

  const ensured = ensureBranchHandles(nodes, edgesRaw as any);
  return { ...flowData, nodes, edges: ensured.edges as any };
}
