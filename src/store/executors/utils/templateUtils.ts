import { replaceVariables } from "@/lib/promptParser";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepReplaceVariablesInUnknown(
  value: unknown,
  variables: Record<string, string>
): unknown {
  if (typeof value === "string") {
    return replaceVariables(value, variables, false);
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepReplaceVariablesInUnknown(item, variables));
  }

  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = deepReplaceVariablesInUnknown(v, variables);
  }
  return out;
}

