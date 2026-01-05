import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown } from "lucide-react";
import type { FormFieldConfig, SelectFieldConfig, MultiSelectFieldConfig } from "@/types/flow";
import { cn } from "@/lib/utils";

interface NodeFormProps {
    fields: FormFieldConfig[];
    formData: Record<string, unknown>;
    formErrors?: Record<string, string>;
    onChange: (fieldName: string, value: unknown) => void;
    className?: string;
}

export function NodeForm({ fields, formData, formErrors = {}, onChange, className }: NodeFormProps) {
    if (!fields || fields.length === 0) return null;

    return (
        <div className={cn("space-y-4", className)}>
            {fields.map((field) => {
                const hasError = !!formErrors[field.name];
                return (
                    <div key={field.name} className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                        </label>

                        {field.type === "select" ? (
                            <Select
                                value={formData[field.name] as string || ""}
                                onValueChange={(val) => onChange(field.name, val)}
                            >
                                <SelectTrigger className={cn("h-10 text-sm", hasError ? "border-red-500" : "border-gray-200")}>
                                    <SelectValue placeholder="请选择" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(field as SelectFieldConfig).options
                                        .filter(opt => {
                                            const val = typeof opt === 'object' && opt !== null ? (opt as { value: string }).value : opt;
                                            return val && val.trim() !== '';
                                        })
                                        .map((opt) => {
                                            const optValue = typeof opt === 'object' && opt !== null ? (opt as { value: string }).value : opt;
                                            const optLabel = typeof opt === 'object' && opt !== null ? (opt as { label: string }).label : opt;
                                            return (
                                                <SelectItem key={optValue} value={optValue}>
                                                    {optLabel}
                                                </SelectItem>
                                            );
                                        })}
                                </SelectContent>
                            </Select>
                        ) : field.type === "multi-select" ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between bg-white border-gray-200 hover:bg-white hover:border-gray-300 font-normal px-3 h-10",
                                            hasError ? "border-red-500" : ""
                                        )}
                                    >
                                        <span className="truncate">
                                            {((formData[field.name] as string[])?.length || 0) > 0
                                                ? `已选择 ${(formData[field.name] as string[]).length} 项`
                                                : "请选择"}
                                        </span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
                                    <div className="max-h-[300px] overflow-y-auto space-y-0.5 settings-scrollbar">
                                        {(field as MultiSelectFieldConfig).options.map((opt) => {
                                            const optValue = typeof opt === 'object' && opt !== null ? (opt as { value: string }).value : opt;
                                            const optLabel = typeof opt === 'object' && opt !== null ? (opt as { label: string }).label : opt;
                                            const currentVals = (formData[field.name] as string[]) || [];
                                            const checked = currentVals.includes(optValue);

                                            return (
                                                <div
                                                    key={optValue}
                                                    className={cn(
                                                        "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors",
                                                        checked ? "bg-black/5 text-black" : "text-gray-600 hover:bg-gray-100"
                                                    )}
                                                    onClick={() => {
                                                        let newVals = [...currentVals];
                                                        if (checked) {
                                                            newVals = newVals.filter(v => v !== optValue);
                                                        } else {
                                                            newVals.push(optValue);
                                                        }
                                                        onChange(field.name, newVals);
                                                    }}
                                                >
                                                    <div className={cn(
                                                        "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                                        checked ? "bg-black border-black" : "border-gray-300 bg-white"
                                                    )}>
                                                        {checked && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{optLabel}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <Textarea
                                placeholder={field.placeholder || "请输入..."}
                                value={(formData[field.name] as string) || ""}
                                onChange={(e) => onChange(field.name, e.target.value)}
                                className={cn(
                                    "min-h-[80px] text-sm resize-none bg-white",
                                    hasError ? "border-red-500" : "border-gray-200"
                                )}
                            />
                        )}

                        {hasError && <p className="text-xs text-red-500 mt-1">{formErrors[field.name]}</p>}
                    </div>
                );
            })}
        </div>
    );
}
