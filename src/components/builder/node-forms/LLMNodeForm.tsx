"use client";
import { useState, useEffect } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TrackedSwitch } from "@/components/ui/tracked-switch";
import { BrainCircuit, Sparkles, Thermometer, Braces, MessageSquare, Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { llmModelsAPI, type LLMModel } from "@/services/llmModelsAPI";
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

  useEffect(() => {
    loadModels();
  }, []);

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
                    <Input {...field} className={STYLES.INPUT} placeholder="给节点起个名字" />
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
                    <FormLabel className={STYLES.LABEL}>选择模型</FormLabel>
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
                            <SelectValue placeholder={modelsLoading ? "加载模型列表..." : "选择模型"} />
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
                        User Prompt (用户指令)
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
                      placeholder="输入发送给智能体的具体指令，支持变量引用..."
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
                        System Prompt (人设与指令)
                    </div>
                </div>
                <FormControl>
                    <Textarea
                      {...field}
                      placeholder="设定智能体的身份角色、行为准则和任务目标。例如：你是一位资深产品经理，请帮我分析..."
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
                            title="创意度 (Temperature)"
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
                        description="让 AI 记住上下文历史对话"
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
                                            <span className="text-xs text-gray-500 font-medium">记忆深度 (轮数)</span>
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
                        title="结构化输出 (JSON)"
                        description="强制智能体以 JSON 格式回复"
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
                            ⚠️ 开启此模式时，请务必在<b>系统提示词</b>中明确要求 AI <b>“以 JSON 格式输出”</b>，否则模型可能会报错或输出空内容。
                        </div>
                    </CapabilityItem>
                )}
            />
        </div>
      </div>
    </div>
  );
}
