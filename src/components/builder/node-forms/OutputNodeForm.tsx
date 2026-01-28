"use client";

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NODE_FORM_STYLES, type BaseNodeFormProps } from "./shared";

const STYLES = NODE_FORM_STYLES;

export function OutputNodeForm({ form }: BaseNodeFormProps) {
  return (
    <div className="space-y-4 px-1 pb-4">
      {/* 1. Base Info Section - Frameless */}
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={STYLES.LABEL}>智能体输出节点</FormLabel>
            <FormControl>
              <Input 
                {...field} 
                className={STYLES.INPUT} 
                placeholder="智能体结果输出" 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
