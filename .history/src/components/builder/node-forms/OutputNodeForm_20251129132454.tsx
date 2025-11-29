"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

interface OutputNodeFormProps {
  form: any;
}

export function OutputNodeForm({ form }: OutputNodeFormProps) {
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
        name="text"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={LABEL_CLASS}>输出文本内容</FormLabel>
            <FormControl>
              <Textarea {...field} readOnly placeholder="运行后将填充输出…" className={`min-h-[100px] ${INPUT_CLASS} cursor-default`} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
