import { listSkills } from "@/lib/skills/skillRegistry";
import { getSkillModelAllowlist } from "@/lib/skills/skillGuard";

export const runtime = "nodejs";

export async function GET() {
  const skills = await listSkills("runtime");
  const payload = skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
  }));
  const allowedModels = getSkillModelAllowlist();
  return Response.json({ skills: payload, allowedModels });
}
