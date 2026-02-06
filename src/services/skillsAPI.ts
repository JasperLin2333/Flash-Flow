export interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

export interface RuntimeSkillsConfig {
  skills: SkillInfo[];
  allowedModels: string[];
}

export const skillsAPI = {
  async listRuntimeSkills(): Promise<RuntimeSkillsConfig> {
    const resp = await fetch("/api/skills/runtime");
    if (!resp.ok) {
      throw new Error("Failed to load skills");
    }
    const data = await resp.json();
    return {
      skills: Array.isArray(data?.skills) ? data.skills : [],
      allowedModels: Array.isArray(data?.allowedModels) ? data.allowedModels : [],
    };
  },
};
