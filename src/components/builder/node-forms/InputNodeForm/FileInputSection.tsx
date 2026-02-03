"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, FileType, HardDrive } from "lucide-react";
import { FILE_TYPE_OPTIONS, type FileInputSectionProps } from "./constants";

/**
 * FileInputSection - 文件/图像输入配置区块 (Refined)
 */
export function FileInputSection({
    enabled,
    fileConfig,
    onConfigChange,
}: FileInputSectionProps) {
    // Parent controls visibility/enabled state usually, but we keep this check just in case
    if (!enabled) return null;

    // 获取已选择的类型显示文本
    const getSelectedDisplay = () => {
        const selected = FILE_TYPE_OPTIONS.filter(opt =>
            fileConfig.allowedTypes.includes(opt.value)
        );
        if (selected.length === 0 || fileConfig.allowedTypes.includes("*/*")) {
            return "选择允许上传的类型";
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
        <div className="space-y-3 pt-1 animate-in slide-in-from-top-1 fade-in duration-200">
            {/* File Type Selector */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight px-0.5 flex items-center gap-1.5">
                    <FileType className="w-3 h-3" />
                    允许的文件类型
                </label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 font-normal px-3 h-9 text-xs focus-visible:ring-1 focus-visible:ring-blue-500 transition-all rounded-lg text-gray-700"
                        >
                            <span className="truncate">
                                {getSelectedDisplay()}
                            </span>
                            <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-1" align="start">
                        <div className="max-h-[300px] overflow-y-auto settings-scrollbar space-y-0.5">
                            {FILE_TYPE_OPTIONS.map(option => {
                                const checked = fileConfig.allowedTypes.includes(option.value);
                                return (
                                    <div
                                        key={option.value}
                                        className={`
                                            flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors text-xs
                                            ${checked ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"}
                                        `}
                                        onClick={() => handleTypeToggle(option.value)}
                                    >
                                        <div className={`
                                            w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0
                                            ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}
                                        `}>
                                            {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className="font-medium">{option.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Limits Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight px-0.5 flex items-center gap-1.5">
                        <HardDrive className="w-3 h-3" />
                        单个文件大小上限（MB）
                    </label>
                    <div className="relative group">
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
                            className="h-9 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs font-medium text-gray-700 pr-8 transition-all rounded-lg"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono pointer-events-none group-hover:text-gray-500">
                            MB
                        </div>
                    </div>
                </div>
                
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight px-0.5 flex items-center gap-1.5">
                        <span className="w-3 h-3 flex items-center justify-center font-mono text-[9px] border border-current rounded bg-transparent opacity-70">N</span>
                        最多上传文件数
                    </label>
                    <div className="relative group">
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
                            className="h-9 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs font-medium text-gray-700 pr-8 transition-all rounded-lg"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono pointer-events-none group-hover:text-gray-500">
                            个
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
