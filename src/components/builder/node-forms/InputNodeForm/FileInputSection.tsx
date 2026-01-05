"use client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { FILE_TYPE_OPTIONS, INPUT_CLASS, SECTION_TITLE_CLASS, type FileInputSectionProps } from "./constants";

/**
 * FileInputSection - 文件/图像输入配置区块
 */
export function FileInputSection({
    enabled,
    onToggle,
    fileConfig,
    onConfigChange,
    isHeaderHidden = false,
}: FileInputSectionProps) {
    if (!enabled && isHeaderHidden) return null;

    // 获取已选择的类型显示文本
    const getSelectedDisplay = () => {
        const selected = FILE_TYPE_OPTIONS.filter(opt =>
            fileConfig.allowedTypes.includes(opt.value)
        );
        if (selected.length === 0 || fileConfig.allowedTypes.includes("*/*")) {
            return "全部类型";
        }
        if (selected.length === 1) {
            return selected[0].label;
        }
        return `已选择 ${selected.length} 种类型`;
    };

    const handleTypeToggle = (value: string) => {
        const isChecked = fileConfig.allowedTypes.includes(value);
        let newTypes: string[];

        if (isChecked) {
            // 取消选择
            newTypes = fileConfig.allowedTypes.filter(t => t !== value && t !== "*/*");
        } else {
            // 选择新类型，同时移除 */*
            newTypes = [...fileConfig.allowedTypes.filter(t => t !== "*/*"), value];
        }

        // 如果没有选择任何类型，默认选择全部
        const finalTypes = newTypes.length === 0 ? ["*/*"] : newTypes;
        onConfigChange({ allowedTypes: finalTypes });
    };

    return (
        <div className="space-y-4">
            {!isHeaderHidden && (
                <div className="flex items-center justify-between">
                    <div className={SECTION_TITLE_CLASS}>
                        <Switch checked={enabled} onCheckedChange={onToggle} />
                        <span>文件/图像输入</span>
                    </div>
                </div>
            )}

            {enabled && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight px-1">允许的文件类型</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between bg-white border-gray-200 hover:bg-white hover:border-gray-300 font-normal px-3 h-8 text-xs focus-visible:ring-1 focus-visible:ring-black"
                                >
                                    <span className="truncate">
                                        {getSelectedDisplay()}
                                    </span>
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
                                <div className="max-h-[300px] overflow-y-auto settings-scrollbar space-y-0.5">
                                    {FILE_TYPE_OPTIONS.map(option => {
                                        const checked = fileConfig.allowedTypes.includes(option.value);
                                        return (
                                            <div
                                                key={option.value}
                                                className={`
                                                    flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors
                                                    ${checked ? "bg-black/5 text-black" : "text-gray-600 hover:bg-gray-100"}
                                                `}
                                                onClick={() => handleTypeToggle(option.value)}
                                            >
                                                <div className={`
                                                    w-4 h-4 rounded border flex items-center justify-center transition-all
                                                    ${checked ? "bg-black border-black" : "border-gray-300 bg-white"}
                                                `}>
                                                    {checked && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="text-sm font-medium">{option.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:bg-gray-50/50">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">单文件限制</label>
                                <span className="text-[9px] text-gray-400 font-mono">MB</span>
                            </div>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={fileConfig.maxSizeMB}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const clamped = Math.min(Math.max(val, 1), 100);
                                    onConfigChange({ maxSizeMB: clamped });
                                }}
                                className={`${INPUT_CLASS} h-7 border-none shadow-none focus-visible:ring-0 p-0 text-gray-700 font-medium`}
                            />
                        </div>
                        <div className="space-y-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:bg-gray-50/50">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">最大数量</label>
                                <span className="text-[10px] text-gray-400">个</span>
                            </div>
                            <Input
                                type="number"
                                min={1}
                                max={10}
                                value={fileConfig.maxCount}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const clamped = Math.min(Math.max(val, 1), 10);
                                    onConfigChange({ maxCount: clamped });
                                }}
                                className={`${INPUT_CLASS} h-7 border-none shadow-none focus-visible:ring-0 p-0 text-gray-700 font-medium`}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
