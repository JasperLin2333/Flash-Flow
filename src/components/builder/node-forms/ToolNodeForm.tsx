"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TOOL_REGISTRY, getAllToolIds, getToolConfig, DEFAULT_TOOL_TYPE, type ToolType } from "@/lib/tools/registry";
import { Info } from "lucide-react";

import { NODE_FORM_STYLES, type BaseNodeFormProps } from "./shared";

const { LABEL: LABEL_CLASS, INPUT: INPUT_CLASS } = NODE_FORM_STYLES;

export function ToolNodeForm({ form }: BaseNodeFormProps) {
    // Use form.watch to reactively update when toolType changes
    const watchedToolType = form.watch("toolType") as ToolType | undefined;
    // Only use web_search as fallback if watchedToolType is truly undefined/empty
    const toolType: ToolType = (watchedToolType && watchedToolType in TOOL_REGISTRY) ? watchedToolType : DEFAULT_TOOL_TYPE;
    const toolConfig = TOOL_REGISTRY[toolType];

    return (
        <div className="space-y-4">
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
                            value={field.value || DEFAULT_TOOL_TYPE}
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
                                        <SelectItem key={id} value={id} className="cursor-pointer">
                                            {config?.name || id}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        {toolConfig && (
                            <FormDescription>
                                {toolConfig.description}
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
