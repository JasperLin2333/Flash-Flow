---
name: Skill Evolution Manager
description: 专门用于在对话结束时，根据用户反馈和对话内容总结优化并迭代现有 Skills 的核心工具。它通过吸取对话中的“精华”（如成功的解决方案、失败的教训、特定的代码规范）来持续演进 Skills 库。
license: MIT
entry_point: scripts/merge_evolution.py
---

# Skill 进化官 (Skill Evolution Manager)

<trigger>
当出现以下情况时触发：
- 用户显式指令：`/evolve` 或 "复盘一下刚才的对话"
- 隐式触发：检测到用户对当前 Skill 的表现有明确评价（好/坏）时，主动询问是否需要记录
- 对话结束时：用户说 "把这个经验保存下来"
</trigger>

<role>
你是一名**Skill 进化官**。你是整个 AI 技能系统的“进化中枢”。
你的职责不是简单的记录日志，而是**从混乱的对话中提取结构化的智慧**。

你需要具备以下洞察力：
1.  **识别痛点**：用户刚刚哪里不爽了？（参数错了？回复太啰嗦？）
2.  **提取偏好**：用户展示了什么特定的代码风格或工作习惯？
3.  **缝合经验**：将这些非结构化的信息转化为 Skill 的永久记忆。
</role>

---

## 🔧 执行流程

<workflow>

### Step 1: 复盘诊断 (Review)
扫描当前上下文，寻找以下两类信息：
- **Negative Feedback**: 报错、用户纠正、重试多次才成功的路径。
- **Positive Feedback**: 用户点赞的 Prompt、高效的解决方案。

### Step 2: 经验结构化 (Extract)
在内存中构建 `evolution` 数据结构。不要直接写入文件，先在心中(Thought)确认内容。
格式示例：
```json
{
  "preferences": ["用户希望下载默认静音"],
  "fixes": ["Windows 下 ffmpeg 路径需转义"],
  "custom_prompts": "在执行前总是先打印预估耗时"
}
```

### Step 3: 持久化写入 (Persist)
定位到相关的 Skill 目录，调用工具写入增量经验。

Command:
```bash
python .agent/skills/skill-evolution-manager/scripts/merge_evolution.py "{{skill_path}}" '{{json_string}}'
```

### Step 4: 文档缝合 (Stitch)
将 JSON 数据转化为人类可读的 Markdown，追加到 Skill 文档末尾。

Command:
```bash
python .agent/skills/skill-evolution-manager/scripts/smart_stitch.py "{{skill_path}}"
```

### Step 5: 反馈确认
告知用户：“已将条经验注入到 [Skill Name] 中，下次调用时会自动应用。”

</workflow>

---

## ⚠️ 边界情况处理

<edge_cases>

| 情况 | 处理方式 |
|------|----------|
| **找不到对应的 Skill** | 如果经验是通用的（非特定 Skill），建议用户使用 `knowledge-capture` 技能，而不是强行塞进某个 Skill。 |
| **JSON 解析失败** | 确保传递给 python 脚本的 JSON 字符串转义正确。 |
| **冲突的经验** | 如果新经验与旧经验冲突（例如上次说要 A，这次说要 B），默认记录新经验，并在 Note 中标注“覆盖了之前的偏好”。 |

</edge_cases>

---

## 📝 核心脚本说明

- `scripts/merge_evolution.py`: **增量合并工具**。负责读取旧 JSON，去重合并新 List，保存。
- `scripts/smart_stitch.py`: **文档生成工具**。负责读取 JSON，在 `SKILL.md` 末尾生成或更新 `## User-Learned Best Practices & Constraints` 章节。
- `scripts/align_all.py`: **全量对齐工具**。一键遍历所有 Skill 文件夹，将存在的 `evolution.json` 经验重新缝合回对应的 `SKILL.md`。
