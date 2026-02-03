"use client";
import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionsEditorProps {
    options: string[];
    onChange: (options: string[]) => void;
    placeholder?: string;
    className?: string;
}

/**
 * OptionsEditor - Notion/飞书风格的标签选项编辑器
 * 
 * 交互特点：
 * 1. 点击标签即可编辑
 * 2. 回车/逗号添加新选项
 * 3. Tab 在选项间切换
 * 4. Backspace 删除空选项
 * 5. 优雅的动画效果
 */
export function OptionsEditor({
    options,
    onChange,
    placeholder = "添加选项…",
    className,
}: OptionsEditorProps) {
    const [inputValue, setInputValue] = useState("");
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // 自动聚焦编辑输入框
    useEffect(() => {
        if (editingIndex !== null) {
            editInputRef.current?.focus();
            editInputRef.current?.select();
        }
    }, [editingIndex]);

    const addOption = (value: string) => {
        // 支持逗号分隔批量添加
        const newOptions = value
            .split(/[,，]/)
            .map(s => s.trim())
            .filter(s => s && !options.includes(s));

        if (newOptions.length > 0) {
            onChange([...options, ...newOptions]);
        }
        setInputValue("");
    };

    const removeOption = (index: number) => {
        const newOptions = [...options];
        newOptions.splice(index, 1);
        onChange(newOptions);
    };

    const updateOption = (index: number, value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
            // 空值则删除
            removeOption(index);
        } else if (options.some((opt, i) => i !== index && opt === trimmed)) {
            // 重复则删除当前项
            removeOption(index);
        } else {
            const newOptions = [...options];
            newOptions[index] = trimmed;
            onChange(newOptions);
        }
        setEditingIndex(null);
        setEditingValue("");
    };

    const handleMainKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (inputValue.trim()) {
                addOption(inputValue);
            }
        } else if (e.key === "Backspace" && inputValue === "" && options.length > 0) {
            // 开始编辑最后一个选项
            const lastIndex = options.length - 1;
            setEditingIndex(lastIndex);
            setEditingValue(options[lastIndex]);
        } else if (e.key === "Tab" && !e.shiftKey && options.length > 0) {
            // Tab 到第一个选项
            e.preventDefault();
            setEditingIndex(0);
            setEditingValue(options[0]);
        }
    };

    const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Enter") {
            e.preventDefault();
            updateOption(index, editingValue);
            // 聚焦回主输入框
            setTimeout(() => inputRef.current?.focus(), 0);
        } else if (e.key === "Escape") {
            setEditingIndex(null);
            setEditingValue("");
            setTimeout(() => inputRef.current?.focus(), 0);
        } else if (e.key === "Backspace" && editingValue === "") {
            e.preventDefault();
            removeOption(index);
            setEditingIndex(null);
            setTimeout(() => inputRef.current?.focus(), 0);
        } else if (e.key === "Tab") {
            e.preventDefault();
            updateOption(index, editingValue);
            if (e.shiftKey) {
                // Shift+Tab 到前一个
                if (index > 0) {
                    setEditingIndex(index - 1);
                    setEditingValue(options[index - 1]);
                } else {
                    setEditingIndex(null);
                    setTimeout(() => inputRef.current?.focus(), 0);
                }
            } else {
                // Tab 到下一个
                if (index < options.length - 1) {
                    setEditingIndex(index + 1);
                    setEditingValue(options[index + 1]);
                } else {
                    setEditingIndex(null);
                    setTimeout(() => inputRef.current?.focus(), 0);
                }
            }
        }
    };

    const startEditing = (index: number) => {
        setEditingIndex(index);
        setEditingValue(options[index]);
    };

    return (
        <div className={cn("space-y-2", className)}>
            {/* 选项列表 */}
            {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {options.map((option, index) => (
                        <div
                            key={`${option}-${index}`}
                            className={cn(
                                "group relative inline-flex items-center rounded-md transition-all duration-150",
                                editingIndex === index
                                    ? ""
                                    : "hover:ring-1 hover:ring-gray-300"
                            )}
                        >
                            {editingIndex === index ? (
                                <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyDown={(e) => handleEditKeyDown(e, index)}
                                    onBlur={() => updateOption(index, editingValue)}
                                    className="px-2.5 py-1 text-xs bg-white rounded-md outline-none min-w-[60px] max-w-[200px]"
                                    style={{ width: `${Math.max(60, editingValue.length * 8 + 20)}px` }}
                                />
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => startEditing(index)}
                                        className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors cursor-text"
                                    >
                                        {option}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeOption(index);
                                        }}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all duration-150 shadow-sm"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 添加新选项输入框 */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleMainKeyDown}
                    onBlur={() => {
                        if (inputValue.trim()) {
                            addOption(inputValue);
                        }
                    }}
                    placeholder={placeholder}
                    className={cn(
                        "w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none transition-all duration-150",
                        "placeholder:text-gray-400",
                        "hover:border-gray-300 focus:border-black focus:ring-1 focus:ring-black focus:bg-white"
                    )}
                />
                {inputValue && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                        回车添加…
                    </span>
                )}
            </div>

            {/* 提示文字 */}
            {options.length > 0 && (
                <p className="text-[10px] text-gray-400 pl-1">
                    点击选项可编辑
                </p>
            )}
        </div>
    );
}
