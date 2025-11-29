"use client";
import { Send } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface PromptBubbleProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  singleLine?: boolean;
}

// 样式常量
const STYLES = {
  SINGLE_LINE_CONTAINER: "relative w-full bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm hover:shadow-md hover:border-gray-300",
  MULTI_LINE_CONTAINER: "relative w-full bg-white border border-gray-200 rounded-2xl px-2 py-2 shadow-sm hover:shadow-md hover:border-gray-300",
  SINGLE_LINE_WRAPPER: "mr-14 flex items-center h-9",
  MULTI_LINE_WRAPPER: "mb-12",
  TEXTAREA: "w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-gray-900 placeholder-gray-400 outline-none transition-colors duration-150 px-4 py-1.5",
  SINGLE_LINE_TEXTAREA: "max-h-[36px] overflow-hidden",
  MULTI_LINE_TEXTAREA: "max-h-[200px] overflow-y-auto",
  SINGLE_LINE_BUTTON: "top-1/2 right-2 -translate-y-1/2",
  MULTI_LINE_BUTTON: "bottom-3 right-3",
  BUTTON_BASE: "absolute h-8 w-8 rounded-full p-0 bg-black text-white hover:bg-black/90 active:bg-black/95 disabled:bg-gray-300 disabled:text-gray-500 transition-colors duration-150 flex items-center justify-center",
} as const;

export default function PromptBubble(props: PromptBubbleProps) {
  const {
    value,
    onChange,
    onSubmit,
    placeholder = "描述你的流程…（Enter 发送，Shift+Enter 换行）",
    disabled,
    className,
  } = props;
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) onSubmit();
      }
    },
    [onSubmit, value, disabled]
  );

  // 检测是否需要多行
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    
    if (!value.trim()) {
      setIsExpanded(false);
      return;
    }
    
    const style = window.getComputedStyle(ta);
    const lh = parseFloat(style.lineHeight) || 24;
    const pt = parseFloat(style.paddingTop) || 0;
    const pb = parseFloat(style.paddingBottom) || 0;
    const singleLineHeight = lh + pt + pb;
    
    const shouldExpand = ta.scrollHeight > singleLineHeight + 2;
    setIsExpanded(shouldExpand);
  }, [value]);

  return (
    <div
      className={cn(
        isExpanded ? STYLES.MULTI_LINE_CONTAINER : STYLES.SINGLE_LINE_CONTAINER,
        className
      )}
    >
      <div className={isExpanded ? STYLES.MULTI_LINE_WRAPPER : STYLES.SINGLE_LINE_WRAPPER}>
        <TextareaAutosize
          ref={taRef}
          minRows={1}
          maxRows={20}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            STYLES.TEXTAREA,
            isExpanded ? STYLES.MULTI_LINE_TEXTAREA : STYLES.SINGLE_LINE_TEXTAREA
          )}
        />
      </div>
      <Button
        onClick={(e) => {
          e.preventDefault();
          if (!disabled && value.trim()) onSubmit();
        }}
        disabled={!value.trim() || disabled}
        className={cn(
          STYLES.BUTTON_BASE,
          isExpanded ? STYLES.MULTI_LINE_BUTTON : STYLES.SINGLE_LINE_BUTTON,
          value.trim() ? "scale-100 opacity-100" : "scale-90 opacity-50"
        )}
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
