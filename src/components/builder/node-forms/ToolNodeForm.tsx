"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TOOL_REGISTRY, getAllToolIds, getToolConfig, type ToolType } from "@/lib/tools/registry";
import type { UseFormReturn } from "react-hook-form";

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches LLMNodeForm pattern for multi-node-type form compatibility
interface ToolNodeFormProps {
    form: UseFormReturn<any>;
}

export function ToolNodeForm({ form }: ToolNodeFormProps) {
    // Use form.watch to reactively update when toolType changes
    const watchedToolType = form.watch("toolType") as ToolType | undefined;
    // Only use web_search as fallback if watchedToolType is truly undefined/empty
    const toolType: ToolType = (watchedToolType && watchedToolType in TOOL_REGISTRY) ? watchedToolType : "web_search";
    const toolConfig = TOOL_REGISTRY[toolType];

    return (
        <>
            {/* Node Label */}
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

            {/* Tool Type Selector */}
            <FormField
                control={form.control}
                name="toolType"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={LABEL_CLASS}>工具类型</FormLabel>
                        <Select
                            key={field.value}
                            onValueChange={field.onChange}
                            value={field.value || "web_search"}
                        >
                            <FormControl>
                                <SelectTrigger className={INPUT_CLASS}>
                                    <SelectValue placeholder="选择工具" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {getAllToolIds().map((id) => {
                                    const config = getToolConfig(id);
                                    return (
                                        <SelectItem key={id} value={id}>
                                            {config?.name || id}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Tool Description */}
            {toolConfig && (
                <div className="text-xs text-gray-500 italic -mt-1">
                    {toolConfig.description}
                </div>
            )}
        </>
    );
}
