export function getSkillModelAllowlist() {
  return (process.env.SKILLS_MODEL_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isSkillModelAllowed(modelId: string | undefined, allowlist?: string[]) {
  if (!modelId) return false;
  const list = allowlist ?? getSkillModelAllowlist();
  if (list.length === 0) return true;
  return list.includes(modelId);
}
