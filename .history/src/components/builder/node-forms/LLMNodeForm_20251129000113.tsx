"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const DEFAULT_MODEL = "doubao-seed-1-6-flash-250828";
const DEFAULT_TEMPERATURE = 0.7;
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

interface LLMNodeFormProps {
  form: any;
}

export function LLMNodeForm({ form }: LLMNodeFormProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={LABEL_CLASS}>节点名称</FormLabel>
            <FormControl>
              <Input {...field} className={`font-medium ${INPUT_CLASS}`} />
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
            <FormLabel className={LABEL_CLASS}>模型</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className={INPUT_CLASS}>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={DEFAULT_MODEL}>豆包-1-6-flash</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="temperature"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel className={LABEL_CLASS}>温度</FormLabel>
              <span className="text-xs text-gray-600 font-mono">{field.value}</span>
            </div>
            <FormControl>
              <Slider
                min={0}
                max={1}
                step={0.1}
                defaultValue={[field.value || DEFAULT_TEMPERATURE]}
                onValueChange={(vals) => field.onChange(vals[0])}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="systemPrompt"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={LABEL_CLASS}>系统提示词</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="你是一名乐于助人的助手…"
                className={`min-h-[120px] font-mono text-xs ${INPUT_CLASS}`}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
