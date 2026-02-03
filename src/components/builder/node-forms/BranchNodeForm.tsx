"use client";

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NODE_FORM_STYLES, type BaseNodeFormProps, CapabilityItem } from "./shared";
import { useMemo } from "react";
import { AlertCircle, CheckCircle2, GitBranch, Code2, PlayCircle } from "lucide-react";
import { validateCondition } from "@/lib/branchConditionParser";

const STYLES = NODE_FORM_STYLES;

export function BranchNodeForm({ form }: BaseNodeFormProps) {
    const conditionValue = form.watch("condition") as string | undefined;

    const validationResult = useMemo(() => {
        if (!conditionValue || !conditionValue.trim()) {
            return { valid: false, error: "请输入分支条件" };
        }
        return validateCondition(conditionValue);
    }, [conditionValue]);

    // Status icon for the capability header
    const statusIcon = validationResult.valid ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
    ) : (
        <AlertCircle className="w-4 h-4 text-red-500" />
    );

    return (
        <div className="space-y-4 px-1 pb-4">
            {/* 1. Base Info Section - Frameless */}
            <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={STYLES.LABEL}>节点名称</FormLabel>
                        <FormControl>
                            <Input 
                                {...field} 
                                className={STYLES.INPUT} 
                                placeholder="例如：条件分支" 
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className={STYLES.SECTION_DIVIDER} />

            {/* 2. Condition Logic Section */}
            <div className="space-y-2">
                <div className={STYLES.SECTION_TITLE}>分支条件</div>
                
                <CapabilityItem
                    icon={<GitBranch className="w-4 h-4" />}
                    iconColorClass="bg-orange-50 text-orange-600"
                    title="分支条件"
                    description="用表达式判断走哪条分支"
                    isExpanded={true}
                    rightElement={statusIcon}
                >
                    <div className="pt-4 pb-2 px-1 space-y-4">
                        <FormField
                            control={form.control}
                            name="condition"
                            rules={{
                                validate: (v) => {
                                    const s = typeof v === "string" ? v : String(v ?? "");
                                    if (!s.trim()) return "请输入分支条件";
                                    const result = validateCondition(s);
                                    return result.valid ? true : (result.error || "条件不合法");
                                }
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className={STYLES.EDITOR_WRAPPER}>
                                            <div className={STYLES.EDITOR_HEADER}>
                                                <div className={STYLES.EDITOR_LABEL}>
                                                    <Code2 className="w-3 h-3" />
                                                    条件表达式
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[10px] font-medium border border-yellow-100/50">
                                                    <span>JavaScript 表达式</span>
                                                </div>
                                            </div>
                                            <Textarea
                                                {...field}
                                                className={STYLES.EDITOR_AREA}
                                                placeholder={'// 示例:\nInput.user_input.includes("error") ||\nLLM.response.startsWith("Yes")'}
                                                spellCheck={false}
                                            />
                                        </div>
                                    </FormControl>
                                    
                                    {/* Validation Feedback */}
                                    <div className={`${STYLES.VALIDATION_CARD} ${
                                        !conditionValue 
                                            ? 'bg-gray-50 border-gray-100 text-gray-500' 
                                            : validationResult.valid 
                                                ? 'bg-green-50/50 border-green-100 text-green-700' 
                                                : 'bg-red-50/50 border-red-100 text-red-700'
                                    }`}>
                                        {validationResult.valid ? (
                                            <div className="flex items-start gap-2.5">
                                                <div className={`mt-0.5 ${conditionValue ? 'text-green-500' : 'text-gray-400'}`}>
                                                    {conditionValue ? <CheckCircle2 className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-medium">
                                                        {conditionValue ? '条件可用' : '请输入条件…'}
                                                    </p>
                                                    {!conditionValue && (
                                                        <p className="text-[10px] opacity-70">
                                                            支持使用 Input、LLM、RAG 等变量进行判断
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-2.5">
                                                <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
                                                <div className="space-y-1">
                                                    <p className="font-medium">条件有误</p>
                                                    <p className="text-[10px] opacity-80 font-mono bg-red-100/50 px-1.5 py-0.5 rounded w-fit">
                                                        {validationResult.error}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </CapabilityItem>
            </div>
        </div>
    );
}
