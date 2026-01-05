"use client";
import { useState, useEffect } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp } from "lucide-react";
import { llmModelsAPI, type LLMModel } from "@/services/llmModelsAPI";
import { LLM_EXECUTOR_CONFIG } from "@/store/constants/executorConfig";
import { showError } from "@/utils/errorNotify";
import { NODE_FORM_STYLES, type BaseNodeFormProps, FormSeparator } from "./shared";

// ============ 配置常量 ============
const LLM_CONFIG = {
  // 使用统一的默认值
  DEFAULT_TEMPERATURE: LLM_EXECUTOR_CONFIG.DEFAULT_TEMPERATURE,
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 1,
  TEMPERATURE_STEP: 0.1,
  SYSTEM_PROMPT_MIN_HEIGHT: 120,
  // Memory defaults - 从 LLM_EXECUTOR_CONFIG 读取
  DEFAULT_MEMORY_MAX_TURNS: LLM_EXECUTOR_CONFIG.DEFAULT_MEMORY_MAX_TURNS,
  MEMORY_MIN_TURNS: LLM_EXECUTOR_CONFIG.MEMORY_MIN_TURNS,
  MEMORY_MAX_TURNS: LLM_EXECUTOR_CONFIG.MEMORY_MAX_TURNS,
} as const;

// 使用共享样式
const STYLES = NODE_FORM_STYLES;

/**
 * LLM 节点配置表单
 * 包含：节点名称、模型选择、温度参数、系统提示词、对话记忆
 * 模型列表从 Supabase 动态加载
 */
export function LLMNodeForm({ form }: BaseNodeFormProps) {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 加载可用模型列表
  const loadModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await llmModelsAPI.listModels();
      setModels(data);
      if (data.length === 0) {
        setModelsError("暂无可用模型");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "加载模型列表失败";
      setModelsError(errorMsg);
      showError("模型加载失败", errorMsg);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
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
            {modelsError ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500">{modelsError}</span>
                <button
                  type="button"
                  onClick={loadModels}
                  className="text-xs text-blue-600 hover:underline"
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
            )}
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
                支持通过{`{{变量名}}`}引用变量的值
              </span>
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="用于设定 AI 的基本行为，例如：让它扮演什么角色、用什么语气回答、重点关注什么、需要避免什么。这些规则会一直影响后续回答。"
                className={`min-h-[${LLM_CONFIG.SYSTEM_PROMPT_MIN_HEIGHT}px] font-mono text-xs ${STYLES.INPUT} bg-white`}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 分隔线 */}
      <FormSeparator />

      {/* 对话记忆区块 */}
      <div className="space-y-2">
        <div className={`${STYLES.LABEL} px-1`}>记忆设置</div>
        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-3">
          {/* 对话记忆开关 */}
          <FormField
            control={form.control}
            name="enableMemory"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-gray-700">记忆</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      启用后，AI将记住同一会话中的对话历史
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
            <div className="pt-3 border-t border-gray-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
              <FormField
                control={form.control}
                name="memoryMaxTurns"
                render={({ field }) => {
                  const currentTurns = field.value ?? LLM_CONFIG.DEFAULT_MEMORY_MAX_TURNS;

                  return (
                    <FormItem>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">最大记忆轮数</span>
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
                      <p className="text-[9px] text-gray-400 mt-1">
                        保留最近 {currentTurns} 轮对话作为上下文
                      </p>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 分隔线 */}
      <FormSeparator />

      {/* 高级参数标题 - 可折叠 */}
      <div className="space-y-3">
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className={`${STYLES.LABEL} px-1 group-hover:text-gray-900 transition-colors`}>高级设置</div>
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          )}
        </div>

        {showAdvanced && (
          <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* 温度参数 */}
            <FormField
              control={form.control}
              name="temperature"
              render={({ field }) => {
                const currentTemp = field.value ?? LLM_CONFIG.DEFAULT_TEMPERATURE;

                return (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">温度</span>
                      <span className="text-xs text-gray-600 font-mono">
                        {currentTemp.toFixed(1)}
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        min={LLM_CONFIG.TEMPERATURE_MIN}
                        max={LLM_CONFIG.TEMPERATURE_MAX}
                        step={LLM_CONFIG.TEMPERATURE_STEP}
                        value={[currentTemp]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="py-2"
                      />
                    </FormControl>
                    <p className="text-[9px] text-gray-400 mt-1">
                      数值越低越精确，数值越高越有创意
                    </p>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* 分隔 */}
            <FormSeparator className="border-gray-200/60 my-3" />

            {/* JSON 输出格式 */}
            <FormField
              control={form.control}
              name="responseFormat"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-700">JSON 输出模式</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        强制 LLM 输出有效的 JSON 格式
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === 'json_object'}
                        onCheckedChange={(checked) => field.onChange(checked ? 'json_object' : 'text')}
                      />
                    </FormControl>
                  </div>
                  {field.value === 'json_object' && (
                    <div className="bg-amber-50 rounded-md p-2 mt-2 border border-amber-100">
                      <p className="text-[9px] text-amber-600 font-medium flex items-center gap-1">
                        提示：请在系统提示词中说明"请以 JSON 格式输出"
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </>
  );
}
