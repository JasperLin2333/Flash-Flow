"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../context-hud/constants";

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

interface BranchNodeFormProps {
    form: UseFormReturn<FormValues>;
}

export function BranchNodeForm({ form }: BranchNodeFormProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={LABEL_CLASS}>节点名称</FormLabel>
                            <FormControl>
                                <Input {...field} className={INPUT_CLASS} placeholder="分支节点" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={LABEL_CLASS}>判断条件</FormLabel>
                            <FormControl>
                                <Input {...field} className={INPUT_CLASS} placeholder='用户输入.user_input.length > 5' />
                            </FormControl>
                            <FormDescription className="text-[10px] text-gray-400">
                                支持格式: 节点名.字段.includes(&quot;值&quot;), .startsWith(), .endsWith(), === , !==, &gt;, &lt;, &gt;=, &lt;=
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
