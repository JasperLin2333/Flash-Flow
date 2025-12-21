"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NODE_FORM_STYLES, type BaseNodeFormProps } from "./shared";

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
              <Input {...field} className={`font-medium ${INPUT_CLASS}`} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />


    </>
  );
}
