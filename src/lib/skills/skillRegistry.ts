import fs from "fs/promises";
import path from "path";

export type SkillScope = "agent" | "runtime";

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  dir: string;
  file: string;
}

export interface SkillDefinition extends SkillInfo {
  content: string;
  frontmatter: Record<string, string>;
}

const FRONTMATTER_DELIM = "---";

function parseFrontmatter(source: string) {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== FRONTMATTER_DELIM) {
    return { frontmatter: {}, body: source };
  }
  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === FRONTMATTER_DELIM) {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return { frontmatter: {}, body: source };
  }
  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join("\n").trim();
  const frontmatter: Record<string, string> = {};
  for (const line of frontmatterLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (key) frontmatter[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return { frontmatter, body };
}

function extractFallbackName(body: string, fallback: string) {
  const match = body.match(/^#\s+(.+)$/m);
  if (match?.[1]) return match[1].trim();
  return fallback;
}

function extractFallbackDescription(body: string) {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const firstParagraph = lines.find((line) => line && !line.startsWith("#"));
  return firstParagraph ?? "";
}

export function getSkillsRoot(scope: SkillScope) {
  return path.join(process.cwd(), "skills", scope);
}

async function readSkillFile(scope: SkillScope, dir: string): Promise<SkillDefinition | null> {
  const file = path.join(dir, "SKILL.md");
  try {
    const raw = await fs.readFile(file, "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);
    const id = path.basename(dir);
    const name = frontmatter.name || extractFallbackName(body, id);
    const description = frontmatter.description || extractFallbackDescription(body);
    return {
      id,
      name,
      description,
      scope,
      dir,
      file,
      content: body,
      frontmatter,
    };
  } catch {
    return null;
  }
}

export async function listSkills(scope: SkillScope, allowlist?: string[]) {
  const root = getSkillsRoot(scope);
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const skills: SkillInfo[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      if (allowlist && allowlist.length > 0 && !allowlist.includes(id)) continue;
      const skill = await readSkillFile(scope, path.join(root, id));
      if (!skill) continue;
      skills.push(skill);
    }
    return skills;
  } catch {
    return [];
  }
}

export async function listSkillDefinitions(scope: SkillScope, allowlist?: string[]) {
  const root = getSkillsRoot(scope);
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const skills: SkillDefinition[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      if (allowlist && allowlist.length > 0 && !allowlist.includes(id)) continue;
      const skill = await readSkillFile(scope, path.join(root, id));
      if (!skill) continue;
      skills.push(skill);
    }
    return skills;
  } catch {
    return [];
  }
}

export async function loadSkill(scope: SkillScope, id: string, allowlist?: string[]) {
  if (allowlist && allowlist.length > 0 && !allowlist.includes(id)) {
    return null;
  }
  const root = getSkillsRoot(scope);
  return readSkillFile(scope, path.join(root, id));
}

export function formatSkillIndex(skills: SkillInfo[]) {
  if (skills.length === 0) return "";
  const lines = skills.map((skill) => {
    const desc = skill.description ? ` - ${skill.description}` : "";
    return `- ${skill.id}${desc}`;
  });
  return [
    "可用技能列表：",
    ...lines,
    "当需要额外能力时，请调用 `skill` 工具并传入技能 id。",
  ].join("\n");
}
