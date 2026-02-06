import { z } from "zod";
import { tool } from "ai";
import type { SkillScope } from "./skillRegistry";
import { listSkills, loadSkill } from "./skillRegistry";

export interface SkillToolOptions {
  scope: SkillScope;
  allowlist?: string[];
}

export async function createSkillTool({ scope, allowlist }: SkillToolOptions) {
  const skills = await listSkills(scope, allowlist);
  const available = skills.map((skill) => `${skill.id}${skill.description ? ` (${skill.description})` : ""}`);
  const description = [
    "加载一个技能并返回其说明内容（来自 SKILL.md）。",
    available.length > 0 ? `可用技能: ${available.join(" | ")}` : "当前没有可用技能。",
  ].join("\n");

  const skillTool = tool({
    description,
    inputSchema: z.object({
      id: z.string().min(1, "Skill id is required").describe("技能 id（目录名）"),
    }),
    execute: async ({ id }) => {
      const skill = await loadSkill(scope, id, allowlist);
      if (!skill) {
        return {
          ok: false,
          error: `Skill not found: ${id}`,
          availableSkills: skills.map((s) => s.id),
        };
      }
      return {
        ok: true,
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.content,
        frontmatter: skill.frontmatter,
      };
    },
  });

  return { skillTool, skills };
}
