"use client";
import { useState, useEffect } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TrackedSwitch } from "@/components/ui/tracked-switch";
import { BrainCircuit, Thermometer, Braces, MessageSquare, Bot, Wrench } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { llmModelsAPI, type LLMModel } from "@/services/llmModelsAPI";
import { skillsAPI, type SkillInfo } from "@/services/skillsAPI";
import { LLM_EXECUTOR_CONFIG } from "@/store/constants/executorConfig";
import { NODE_FORM_STYLES, type BaseNodeFormProps, CapabilityItem } from "./shared";

// ============ 配置常量 ============
const LLM_CONFIG = {
  DEFAULT_TEMPERATURE: LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 1,
  TEMPERATURE_STEP: 0.1,
  DEFAULT_MEMORY_MAX_TURNS: LLM_EXECUTOR_CONFIG.DEFAULT_MEMORY_MAX_TURNS,
  MEMORY_MIN_TURNS: LLM_EXECUTOR_CONFIG.MEMORY_MIN_TURNS,
  MEMORY_MAX_TURNS: LLM_EXECUTOR_CONFIG.MEMORY_MAX_TURNS,
} as const;

const STYLES = NODE_FORM_STYLES;

/**
 * LLM 节点配置表单 - 优化版
 */
export function LLMNodeForm({ form }: BaseNodeFormProps) {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillQuery, setSkillQuery] = useState("");

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      setModelsError(null);
      const data = await llmModelsAPI.listModels();
      setModels(data);
    } catch (err) {
      console.error("Failed to load models:", err);
      setModelsError("无法加载模型列表，请稍后重试");
    } finally {
      setModelsLoading(false);
    }
  };

  const loadSkills = async () => {
    try {
      setSkillsLoading(true);
      setSkillsError(null);
      const data = await skillsAPI.listRuntimeSkills();
      setSkills(data.skills);
      setAllowedModels(data.allowedModels);
    } catch (err) {
      console.error("Failed to load skills:", err);
      setSkillsError("无法加载技能列表，请稍后重试");
    } finally {
      setSkillsLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
    loadSkills();
  }, []);

  const enableSkills = useWatch({ control: form.control, name: "enableSkills" }) === true;
  const selectedSkillIds = useWatch({ control: form.control, name: "skillIds" }) as string[] | undefined;
  const selectedModel = useWatch({ control: form.control, name: "model" }) as string | undefined;
  const selectedSkills = Array.isArray(selectedSkillIds) ? selectedSkillIds : [];
  const modelAllowed = allowedModels.length === 0 || (selectedModel ? allowedModels.includes(selectedModel) : false);
  const toolSupportState = !selectedModel
    ? "unknown"
    : allowedModels.length === 0
      ? "default"
      : modelAllowed
        ? "allowed"
        : "blocked";
  const toolSupportLabel =
    toolSupportState === "unknown"
      ? "未选择模型"
      : toolSupportState === "default"
        ? "默认允许"
        : toolSupportState === "allowed"
          ? "支持"
          : "不支持";
  const toolSupportDesc =
    toolSupportState === "unknown"
      ? "选择模型后显示工具调用能力"
      : toolSupportState === "default"
        ? "未配置白名单，默认允许工具调用"
        : toolSupportState === "allowed"
          ? "该模型在技能白名单中"
          : "该模型不在技能白名单中";
  const filteredSkills = skills.filter((skill) => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      skill.id.toLowerCase().includes(q) ||
      skill.name.toLowerCase().includes(q) ||
      (skill.description || "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!modelAllowed && enableSkills) {
      form.setValue("enableSkills", false, { shouldDirty: true });
      form.setValue("skillIds", [], { shouldDirty: true });
    }
  }, [modelAllowed, enableSkills, form]);

  const toggleSkill = (id: string) => {
    const next = selectedSkills.includes(id)
      ? selectedSkills.filter((skillId) => skillId !== id)
      : [...selectedSkills, id];
    form.setValue("skillIds", next, { shouldDirty: true });
  };

  return (
    <div className="space-y-4 px-1 pb-4">
      {/* 1. 基础信息 & 模型选择 - Stacked */}
      <div className="grid gap-4">
            <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className={STYLES.LABEL}>节点名称</FormLabel>
                    <FormControl>
                    <Input {...field} className={STYLES.INPUT} placeholder="例如：生成摘要" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className={STYLES.LABEL}>模型</FormLabel>
                    {modelsError ? (
                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                        <span className="text-xs text-red-500">{modelsError}</span>
                        <button
                        type="button"
                        onClick={loadModels}
                        className="text-xs text-blue-600 hover:underline font-medium"
                        >
                        重试
                        </button>
                    </div>
                    ) : (
                    <Select
                        key={field.value}
                        onValueChange={field.onChange}
                        value={field.value}
                    >
                        <FormControl>
                        <SelectTrigger className={STYLES.INPUT} disabled={modelsLoading}>
                            <SelectValue placeholder={modelsLoading ? "正在加载模型…" : "选择一个模型"} />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {models.map(model => (
                            <SelectItem key={model.id} value={model.model_id} className="cursor-pointer text-xs">
                            <div className="flex items-center gap-2">
                                <span>{model.model_name}</span>
                            </div>
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    )}
                    <FormMessage />
                </FormItem>
                )}
            />
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span
                className={`h-2 w-2 rounded-full ${
                  toolSupportState === "allowed"
                    ? "bg-emerald-500"
                    : toolSupportState === "blocked"
                      ? "bg-rose-500"
                      : toolSupportState === "default"
                        ? "bg-amber-500"
                        : "bg-gray-300"
                }`}
              />
              <span className="font-medium text-gray-700">工具调用：{toolSupportLabel}</span>
              <span className="text-gray-400">{toolSupportDesc}</span>
            </div>
      </div>

      <div className={STYLES.SECTION_DIVIDER} />

      {/* 2. User Prompt - 核心输入项提升 */}
      <FormField
        control={form.control}
        name="inputMappings.user_input"
        render={({ field }) => (
          <FormItem>
            <div className={`${STYLES.EDITOR_WRAPPER} border-indigo-200 ring-indigo-500/10`}>
                <div className={`${STYLES.EDITOR_HEADER} bg-indigo-50/50`}>
                    <div className={`${STYLES.EDITOR_LABEL} text-indigo-600`}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        用户指令
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium cursor-help hover:bg-indigo-100 transition-colors border border-indigo-100/50">
                              <span className="font-mono text-[10px] opacity-70">{"{{ }}"}</span>
                              <span>引用变量</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs max-w-[220px] p-3 shadow-lg">
                            <p className="font-semibold mb-1">如何引用上游变量？</p>
                            <p className="text-gray-500 leading-relaxed">
                              输入 <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{"{{节点名.变量}}"}</span> 即可引用上游节点的输出内容。
                            </p>
                          </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="写清楚要让 AI 做什么，支持 {{变量}} 引用…"
                      className={STYLES.EDITOR_AREA + " min-h-[100px]"}
                      spellCheck={false}
                    />
                </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 3. 系统提示词 - IDE 风格 */}
      <FormField
        control={form.control}
        name="systemPrompt"
        render={({ field }) => (
          <FormItem>
            <div className={STYLES.EDITOR_WRAPPER}>
                <div className={STYLES.EDITOR_HEADER}>
                    <div className={STYLES.EDITOR_LABEL}>
                        <Bot className="w-3.5 h-3.5" />
                        系统提示词（角色与规则）
                    </div>
                </div>
                <FormControl>
                    <Textarea
                      {...field}
                      placeholder="设定 AI 的角色与规则。例如：你是一位资深产品经理，请帮我分析…"
                      className={STYLES.EDITOR_AREA + " min-h-[80px] text-gray-600"}
                      spellCheck={false}
                    />
                </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className={STYLES.SECTION_DIVIDER} />

      {/* 4. 模型能力配置 (Model Capabilities) */}
      <div className="space-y-2">
        <div className={STYLES.SECTION_TITLE}>模型配置</div>
        
        <div className={`${STYLES.CARD} p-0 overflow-hidden divide-y divide-gray-100`}>
            {/* Item 1: Creativity (Temperature) */}
            <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => {
                    const currentTemp = field.value ?? LLM_CONFIG.DEFAULT_TEMPERATURE;
                    return (
                        <CapabilityItem
                            icon={<Thermometer className="w-4 h-4" />}
                            iconColorClass="bg-indigo-50 text-indigo-600"
                            title="创意度（温度）"
                            description={`当前值: ${currentTemp.toFixed(1)} - ${currentTemp < 0.3 ? '严谨' : currentTemp > 0.7 ? '发散' : '平衡'}`}
                            isExpanded={true} // Always show slider
                            className="bg-white" // Override hover effect since it's static
                        >
                            <div className="pt-2 pb-1 pr-4">
                                <Slider
                                    min={LLM_CONFIG.TEMPERATURE_MIN}
                                    max={LLM_CONFIG.TEMPERATURE_MAX}
                                    step={LLM_CONFIG.TEMPERATURE_STEP}
                                    value={[currentTemp]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                    className="py-1"
                                />
                                <div className={STYLES.SLIDER_RANGE}>
                                    <span>严谨 (0.0)</span>
                                    <span>发散 (1.0)</span>
                                </div>
                            </div>
                        </CapabilityItem>
                    );
                }}
            />

            {/* Item 2: Context Memory */}
            <FormField
                control={form.control}
                name="enableMemory"
                render={({ field }) => (
                    <CapabilityItem
                        icon={<BrainCircuit className="w-4 h-4" />}
                        iconColorClass="bg-violet-50 text-violet-600"
                        title="对话记忆"
                            description="让 AI 记住对话上下文"
                        isExpanded={field.value}
                        rightElement={
                            <TrackedSwitch
                                trackingName="enableMemory"
                                nodeType="llm"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        }
                    >
                        {/* Memory Slider */}
                        <FormField
                            control={form.control}
                            name="memoryMaxTurns"
                            render={({ field: sliderField }) => {
                                const currentTurns = sliderField.value ?? LLM_CONFIG.DEFAULT_MEMORY_MAX_TURNS;
                                return (
                                    <div className="pt-2 pb-1 pr-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs text-gray-500 font-medium">记忆轮数</span>
                                            <span className={STYLES.SLIDER_VALUE}>{currentTurns} 轮</span>
                                        </div>
                                        <Slider
                                            min={LLM_CONFIG.MEMORY_MIN_TURNS}
                                            max={LLM_CONFIG.MEMORY_MAX_TURNS}
                                            step={1}
                                            value={[currentTurns]}
                                            onValueChange={(vals) => sliderField.onChange(vals[0])}
                                            className="py-1"
                                        />
                                        <div className={STYLES.SLIDER_RANGE}>
                                            <span>{LLM_CONFIG.MEMORY_MIN_TURNS}</span>
                                            <span>{LLM_CONFIG.MEMORY_MAX_TURNS}</span>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    </CapabilityItem>
                )}
            />

            {/* Item 3: JSON Mode */}
            <FormField
                control={form.control}
                name="responseFormat"
                render={({ field }) => (
                    <CapabilityItem
                        icon={<Braces className="w-4 h-4" />}
                        iconColorClass="bg-amber-50 text-amber-600"
                        title="结构化输出（JSON）"
                        description="让 AI 以 JSON 格式输出"
                        isExpanded={field.value === 'json_object'}
                        rightElement={
                            <TrackedSwitch
                                trackingName="responseFormat"
                                nodeType="llm"
                                checked={field.value === 'json_object'}
                                onCheckedChange={(checked) => field.onChange(checked ? 'json_object' : 'text')}
                            />
                        }
                    >
                        <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100/50 text-[11px] text-amber-700 leading-relaxed">
                            ⚠️ 开启后，请在<b>系统提示词</b>里明确要求 AI <b>“只输出 JSON”</b>，否则可能出现输出不完整或解析失败。
                        </div>
                    </CapabilityItem>
                )}
            />
        </div>
      </div>

      <div className={STYLES.SECTION_DIVIDER} />

      {/* 5. 工具/技能 */}
      <div className="space-y-2">
        <div className={STYLES.SECTION_TITLE}>工具 / 技能</div>
        <div className={`${STYLES.CARD} p-0 overflow-hidden divide-y divide-gray-100`}>
          <FormField
            control={form.control}
            name="enableSkills"
            render={({ field }) => (
              <CapabilityItem
                icon={<Wrench className="w-4 h-4" />}
                iconColorClass="bg-amber-50 text-amber-600"
                title="启用技能"
                description="允许模型调用本地 skills/runtime 下的技能"
                isExpanded={field.value}
                rightElement={
                  <TrackedSwitch
                    trackingName="enableSkills"
                    nodeType="llm"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!modelAllowed}
                  />
                }
              >
                <div className="py-2 pr-4 space-y-2">
                  {skillsError ? (
                    <div className="text-xs text-red-500">{skillsError}</div>
                  ) : skillsLoading ? (
                    <div className="text-xs text-gray-500">正在加载技能列表…</div>
                  ) : skills.length === 0 ? (
                    <div className="text-xs text-gray-500">
                      未发现技能，请在 <span className="font-mono">skills/runtime</span> 下添加技能。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {!modelAllowed && (
                        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                          当前模型未在技能白名单中，无法启用技能。
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">已选择技能</div>
                        {selectedSkills.length === 0 ? (
                          <div className="text-xs text-gray-400">尚未选择技能</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedSkills.map((skillId) => (
                              <button
                                key={skillId}
                                type="button"
                                onClick={() => toggleSkill(skillId)}
                                className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 hover:border-gray-300"
                                disabled={!enableSkills}
                              >
                                <span className="font-mono">{skillId}</span>
                                <span className="text-gray-400">×</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">选择技能</div>
                        <Input
                          value={skillQuery}
                          onChange={(e) => setSkillQuery(e.target.value)}
                          placeholder="搜索技能…"
                          className={STYLES.INPUT}
                          disabled={!enableSkills || !modelAllowed}
                        />
                        {allowedModels.length > 0 && (
                          <div className="text-[11px] text-gray-400">
                            技能白名单模型: {allowedModels.join(", ")}
                          </div>
                        )}
                        <div className="space-y-2">
                          {filteredSkills.map((skill) => (
                            <label
                              key={skill.id}
                              className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-xs transition-colors ${
                                enableSkills && modelAllowed
                                  ? "border-gray-200 hover:border-gray-300"
                                  : "border-gray-100 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={selectedSkills.includes(skill.id)}
                                onChange={() => toggleSkill(skill.id)}
                                disabled={!enableSkills || !modelAllowed}
                              />
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-gray-900">{skill.name}</div>
                                {skill.description && (
                                  <div className="text-xs text-gray-500">{skill.description}</div>
                                )}
                                <div className="text-[11px] text-gray-400 font-mono">id: {skill.id}</div>
                              </div>
                            </label>
                          ))}
                          {filteredSkills.length === 0 && (
                            <div className="text-xs text-gray-400">没有匹配的技能</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CapabilityItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
