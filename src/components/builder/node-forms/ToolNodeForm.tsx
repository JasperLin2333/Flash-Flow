"use client";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TOOL_REGISTRY, getAllToolIds, getToolConfig, type ToolType } from "@/lib/tools/registry";
import { z } from "zod";
import { useMemo } from "react";

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-gray-500";
const INPUT_CLASS = "bg-gray-50 border-gray-200 text-gray-900";

interface ToolNodeFormProps {
    form: any;
}

/**
 * Dynamic input renderer for tool form fields
 */
function DynamicFormField({ fieldName, schema, form }: { fieldName: string; schema: z.ZodTypeAny; form: any }) {
    const description = schema.description || "";
    const isOptional = schema.isOptional();
    const defaultValue = schema instanceof z.ZodDefault ? (schema._def.defaultValue as () => unknown)() : undefined;
    const innerSchema = schema instanceof z.ZodOptional || schema instanceof z.ZodDefault ? schema._def.innerType : schema;

    if (innerSchema instanceof z.ZodString) {
        return (
            <FormField
                control={form.control}
                name={`inputs.${fieldName}`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={LABEL_CLASS}>
                            {fieldName.replace(/_/g, " ")}
                            {isOptional && <span className="ml-1 text-gray-400">(optional)</span>}
                        </FormLabel>
                        <FormControl>
                            <Input {...field} value={field.value || ""} placeholder={description} className={INPUT_CLASS} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    if (innerSchema instanceof z.ZodNumber) {
        return (
            <FormField
                control={form.control}
                name={`inputs.${fieldName}`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={LABEL_CLASS}>
                            {fieldName.replace(/_/g, " ")}
                            {isOptional && <span className="ml-1 text-gray-400">(optional)</span>}
                        </FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                {...field}
                                value={field.value ?? defaultValue ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                placeholder={description}
                                className={INPUT_CLASS}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    if (innerSchema instanceof z.ZodBoolean) {
        return (
            <FormField
                control={form.control}
                name={`inputs.${fieldName}`}
                render={({ field }) => (
                    <FormItem>
                        <div className="flex items-center justify-between py-2">
                            <FormLabel className={LABEL_CLASS}>
                                {fieldName.replace(/_/g, " ")}
                            </FormLabel>
                            <FormControl>
                                <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                            </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    return null;
}

export function ToolNodeForm({ form }: ToolNodeFormProps) {
    const watchedToolType = form.watch("toolType") as ToolType;
    const toolType = watchedToolType || "web_search";
    const toolConfig = TOOL_REGISTRY[toolType];

    // Parse schema fields
    const schemaFields = useMemo(() => {
        if (!toolConfig?.schema) return [];

        const shape = (toolConfig.schema as z.ZodObject<any>)._def.shape;
        if (!shape) return [];

        return Object.entries(shape).map(([key, value]) => ({
            name: key,
            schema: value as z.ZodTypeAny,
        }));
    }, [toolConfig]);

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
                        <Select onValueChange={field.onChange} value={field.value || "web_search"}>
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
            {/* Dynamic Input Fields - Removed as per requirement */}
            {/* Tool parameters are now handled via debug dialog or upstream inputs */}
        </>
    );
}
