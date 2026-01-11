"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NODE_FORM_STYLES, type BaseNodeFormProps } from "./shared";
import { cn } from "@/lib/utils";

const { LABEL: LABEL_CLASS, INPUT: INPUT_CLASS } = NODE_FORM_STYLES;

export function OutputNodeForm({ form }: BaseNodeFormProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={LABEL_CLASS}>节点名称</FormLabel>
            <FormControl>
              <Input {...field} className={cn(INPUT_CLASS, "h-9")} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />


    </>
  );
}
