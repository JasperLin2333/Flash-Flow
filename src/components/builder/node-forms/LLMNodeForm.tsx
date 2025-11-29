"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// ============ 配置常量 ============
const LLM_CONFIG = {
  DEFAULT_MODEL: "doubao-seed-1-6-flash-250828",
  DEFAULT_TEMPERATURE: 0.7,
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 1,
  TEMPERATURE_STEP: 0.1,
  SYSTEM_PROMPT_MIN_HEIGHT: 120,
} as const;

const AVAILABLE_MODELS = [
  { value: "doubao-seed-1-6-flash-250828", label: "豆包-1-6-flash" },
  // 未来可以在这里添加更多模型
] as const;

// ============ 样式常量 ============
const STYLES = {
  LABEL: "text-[10px] font-bold uppercase tracking-wider text-gray-500",
  INPUT: "bg-gray-50 border-gray-200 text-gray-900",
} as const;

interface LLMNodeFormProps {
  form: any;
}

/**
 * LLM 节点配置表单
 * 包含：节点名称、模型选择、温度参数、系统提示词
 */
export function LLMNodeForm({ form }: LLMNodeFormProps) {
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
            <Select onValueChange={field.onChange} defaultValue={field.value || LLM_CONFIG.DEFAULT_MODEL}>
              <FormControl>
                <SelectTrigger className={STYLES.INPUT}>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {AVAILABLE_MODELS.map(model => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
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
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel className={STYLES.LABEL}>温度</FormLabel>
              <span className="text-xs text-gray-600 font-mono">{field.value ?? LLM_CONFIG.DEFAULT_TEMPERATURE}</span>
            </div>
            <FormControl>
              <Slider
                min={LLM_CONFIG.TEMPERATURE_MIN}
                max={LLM_CONFIG.TEMPERATURE_MAX}
                step={LLM_CONFIG.TEMPERATURE_STEP}
                defaultValue={[field.value ?? LLM_CONFIG.DEFAULT_TEMPERATURE]}
                onValueChange={(vals) => field.onChange(vals[0])}
                className="py-2"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
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
                支持变量：{`{{variable_name}}`}
              </span>
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="你是一名乐于助人的助手…"
                className={`min-h-[${LLM_CONFIG.SYSTEM_PROMPT_MIN_HEIGHT}px] font-mono text-xs ${STYLES.INPUT}`}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
