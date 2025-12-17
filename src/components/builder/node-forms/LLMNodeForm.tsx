"use client";
import { useState, useEffect } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { llmModelsAPI, type LLMModel } from "@/services/llmModelsAPI";
import type { LLMNodeData } from "@/types/flow";
import { LLM_EXECUTOR_CONFIG } from "@/store/constants/executorConfig";

// ============ 配置常量 ============
const LLM_CONFIG = {
  // 使用统一的默认值
  DEFAULT_TEMPERATURE: LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 1,
  TEMPERATURE_STEP: 0.1,
  SYSTEM_PROMPT_MIN_HEIGHT: 120,
  // Memory defaults
  DEFAULT_MEMORY_MAX_TURNS: 10,
  MEMORY_MIN_TURNS: 1,
  MEMORY_MAX_TURNS: 20,
} as const;

// ============ 样式常量 ============
const STYLES = {
  LABEL: "text-[10px] font-bold uppercase tracking-wider text-gray-500",
  INPUT: "bg-gray-50 border-gray-200 text-gray-900",
} as const;

interface LLMNodeFormProps {
  // 父组件使用多态表单 schema，包含多种节点类型的字段，
  // 因此此处使用 any 类型而非严格类型
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

/**
 * LLM 节点配置表单
 * 包含：节点名称、模型选择、温度参数、系统提示词、对话记忆
 * 模型列表从 Supabase 动态加载
 */
export function LLMNodeForm({ form }: LLMNodeFormProps) {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  // 加载可用模型列表
  useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true);
      const data = await llmModelsAPI.listModels();
      setModels(data);
      setModelsLoading(false);
    };
    loadModels();
  }, []);

  // 监听记忆开关状态
  // FIX: Use useWatch for reliable re-renders in child component
  const enableMemory = useWatch({
    control: form.control,
    name: "enableMemory",
    defaultValue: false,
  });

  return (
    <>
      {/* 节点名称 */}
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={STYLES.LABEL}>节点名称</FormLabel>
            <FormControl>
              <Input {...field} className={`font-medium ${STYLES.INPUT}`} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 模型选择 */}
      <FormField
        control={form.control}
        name="model"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={STYLES.LABEL}>模型</FormLabel>
            <Select
              key={field.value}
              onValueChange={field.onChange}
              value={field.value}
            >
              <FormControl>
                <SelectTrigger className={STYLES.INPUT} disabled={modelsLoading}>
                  <SelectValue placeholder={modelsLoading ? "加载中..." : "选择模型"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.id} value={model.model_id}>
                    {model.model_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 温度参数 */}
      <FormField
        control={form.control}
        name="temperature"
        render={({ field }) => {
          // FIX: Extract current temperature value with proper fallback
          const currentTemp = field.value ?? LLM_CONFIG.DEFAULT_TEMPERATURE;

          return (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className={STYLES.LABEL}>温度</FormLabel>
                <span className="text-xs text-gray-600 font-mono">
                  {currentTemp.toFixed(1)}
                </span>
              </div>
              <FormControl>
                {/* 
                  CRITICAL FIX: Use controlled mode (value) instead of uncontrolled (defaultValue)
                  
                  WHY: Radix Slider with defaultValue only sets initial position on mount.
                  When field.value changes, the slider position doesn't update, causing
                  visual mismatch between displayed number and slider position.
                  
                  SOLUTION: Use value prop to make it fully controlled by form state.
                  This ensures slider position always reflects field.value.
                */}
                <Slider
                  min={LLM_CONFIG.TEMPERATURE_MIN}
                  max={LLM_CONFIG.TEMPERATURE_MAX}
                  step={LLM_CONFIG.TEMPERATURE_STEP}
                  value={[currentTemp]}
                  onValueChange={(vals) => field.onChange(vals[0])}
                  className="py-2"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      {/* 系统提示词 */}
      <FormField
        control={form.control}
        name="systemPrompt"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={STYLES.LABEL}>
              系统提示词
              <span className="ml-2 text-[9px] font-normal text-gray-400 normal-case">
                提示词支持变量引用：{`{{变量名}}`}
              </span>
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="系统提示词用于设定 AI 的基本行为。例如：让它扮演什么角色、用什么语气回答、重点关注什么、需要避免什么。这些规则会一直影响后续回答。"
                className={`min-h-[${LLM_CONFIG.SYSTEM_PROMPT_MIN_HEIGHT}px] font-mono text-xs ${STYLES.INPUT}`}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 分隔线 */}
      <div className="border-t border-gray-100 my-2" />

      {/* 对话记忆开关 */}
      <FormField
        control={form.control}
        name="enableMemory"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <div>
                <FormLabel className={STYLES.LABEL}>对话记忆</FormLabel>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  启用后，LLM 将记住同一会话中的对话历史
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 最大记忆轮数（仅在记忆启用时显示） */}
      {enableMemory && (
        <FormField
          control={form.control}
          name="memoryMaxTurns"
          render={({ field }) => {
            const currentTurns = field.value ?? LLM_CONFIG.DEFAULT_MEMORY_MAX_TURNS;

            return (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className={STYLES.LABEL}>最大记忆轮数</FormLabel>
                  <span className="text-xs text-gray-600 font-mono">
                    {currentTurns} 轮
                  </span>
                </div>
                <FormControl>
                  <Slider
                    min={LLM_CONFIG.MEMORY_MIN_TURNS}
                    max={LLM_CONFIG.MEMORY_MAX_TURNS}
                    step={1}
                    value={[currentTurns]}
                    onValueChange={(vals) => field.onChange(vals[0])}
                    className="py-2"
                  />
                </FormControl>
                <p className="text-[9px] text-gray-400">
                  保留最近 {currentTurns} 轮对话作为上下文
                </p>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      )}
    </>
  );
}
