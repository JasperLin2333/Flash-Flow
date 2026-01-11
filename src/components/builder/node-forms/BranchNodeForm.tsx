"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NODE_FORM_STYLES, type BaseNodeFormProps } from "./shared";
import { useMemo } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { validateCondition } from "@/lib/branchConditionParser";

const { LABEL: LABEL_CLASS, INPUT: INPUT_CLASS, TEXTAREA: TEXTAREA_CLASS } = NODE_FORM_STYLES;

export function BranchNodeForm({ form }: BaseNodeFormProps) {
    const conditionValue = form.watch("condition") as string | undefined;

    const validationResult = useMemo(() => {
        return validateCondition(conditionValue || "");
    }, [conditionValue]);

    return (
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
                            <Textarea
                                {...field}
                                className={`${TEXTAREA_CLASS} min-h-[80px] py-2 ${!validationResult.valid ? 'border-amber-400 focus:ring-amber-400' : ''}`}
                                placeholder='例如：Input.text.includes("error") || LLM.answer.startsWith("Yes")'
                            />
                        </FormControl>
                        {validationResult.valid ? (
                            <FormDescription className="text-[10px] text-gray-400 space-y-0.5">
                                <span className="flex items-center gap-1">
                                    {conditionValue?.trim() && (
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    )}
                                    <span>示例: Input.text.includes(&quot;error&quot;), LLM.score &gt; 0.8, A.status === &apos;done&apos; &amp;&amp; B.count &lt; 5</span>
                                </span>
                            </FormDescription>
                        ) : (
                            <FormDescription className="text-[10px] text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {validationResult.error}
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
