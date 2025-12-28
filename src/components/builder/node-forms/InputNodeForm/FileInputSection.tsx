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
    isHeaderHidden = false,
}: FileInputSectionProps) {
    if (!enabled && isHeaderHidden) return null;

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
                        <div className="grid grid-cols-1 gap-1 border border-gray-100 rounded-xl p-2 bg-white shadow-sm overflow-hidden">
                            {FILE_TYPE_OPTIONS.map((option) => (
                                <div key={option.value} className="flex items-center gap-2 group cursor-pointer hover:bg-gray-50/80 p-1.5 rounded-lg transition-colors">
                                    <input
                                        type="checkbox"
                                        id={`filetype-${option.value.replace(/[.,/*]/g, '-')}`}
                                        checked={fileConfig.allowedTypes.includes(option.value)}
                                        onChange={(e) => {
                                            const newTypes = e.target.checked
                                                ? [...fileConfig.allowedTypes.filter(t => t !== "*/*"), option.value]
                                                : fileConfig.allowedTypes.filter((t) => t !== option.value);

                                            // Fallback to all if nothing selected
                                            const finalTypes = newTypes.length === 0 ? ["*/*"] : newTypes;
                                            onConfigChange({ allowedTypes: finalTypes });
                                        }}
                                        className="rounded-sm border-gray-300 cursor-pointer w-3.5 h-3.5 accent-blue-600"
                                    />
                                    <label
                                        htmlFor={`filetype-${option.value.replace(/[.,/*]/g, '-')}`}
                                        className="text-xs text-gray-600 cursor-pointer flex-1 select-none"
                                    >
                                        {option.label}
                                    </label>
                                </div>
                            ))}
                        </div>
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
                                max={500}
                                value={fileConfig.maxSizeMB}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const clamped = Math.min(Math.max(val, 1), 500);
                                    onConfigChange({ maxSizeMB: clamped });
                                }}
                                className={`${INPUT_CLASS} h-7 border-none shadow-none focus-visible:ring-0 p-0 text-gray-700 font-medium`}
                            />
                        </div>
                        <div className="space-y-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:bg-gray-50/50">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">允许最大数量</label>
                                <span className="text-[9px] text-gray-400 font-mono">FILES</span>
                            </div>
                            <Input
                                type="number"
                                min={1}
                                max={50}
                                value={fileConfig.maxCount}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const clamped = Math.min(Math.max(val, 1), 50);
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
