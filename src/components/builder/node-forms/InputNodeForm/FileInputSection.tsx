"use client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FILE_TYPE_OPTIONS, INPUT_CLASS, SECTION_TITLE_CLASS, type FileInputSectionProps } from "./constants";

/**
 * FileInputSection - 文件/图像输入配置区块
 */
export function FileInputSection({
    enabled,
    onToggle,
    fileConfig,
    onConfigChange,
}: FileInputSectionProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className={SECTION_TITLE_CLASS}>
                    <Switch checked={enabled} onCheckedChange={onToggle} />
                    <span>文件/图像输入</span>
                </div>
            </div>

            {enabled && (
                <div className="pl-7 space-y-3 border-l-2 border-gray-200">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">文件类型</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                            {FILE_TYPE_OPTIONS.map((option) => (
                                <div key={option.value} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id={`filetype-${option.value.replace(/[.,/*]/g, '-')}`}
                                        checked={fileConfig.allowedTypes.includes(option.value)}
                                        onChange={(e) => {
                                            const newTypes = e.target.checked
                                                ? [...fileConfig.allowedTypes, option.value]
                                                : fileConfig.allowedTypes.filter((t) => t !== option.value);
                                            onConfigChange({ allowedTypes: newTypes });
                                        }}
                                        className="rounded border-gray-300 cursor-pointer"
                                    />
                                    <label
                                        htmlFor={`filetype-${option.value.replace(/[.,/*]/g, '-')}`}
                                        className="text-xs text-gray-700 cursor-pointer flex-1"
                                    >
                                        {option.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">最大体积 (MB)</label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={fileConfig.maxSizeMB}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    // Clamp between 1 and 100
                                    const clamped = Math.min(Math.max(val, 1), 100);
                                    onConfigChange({ maxSizeMB: clamped });
                                }}
                                className={INPUT_CLASS}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">最大数量</label>
                            <Input
                                type="number"
                                min={1}
                                max={10}
                                value={fileConfig.maxCount}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    // Clamp between 1 and 10
                                    const clamped = Math.min(Math.max(val, 1), 10);
                                    onConfigChange({ maxCount: clamped });
                                }}
                                className={INPUT_CLASS}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
