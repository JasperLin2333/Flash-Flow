"use client";

import { AlertCircle, RotateCcw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ============ 常量 ============
const ERROR_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

const STYLES = {
  container: "fixed bottom-24 left-8 z-20 max-w-md",
  content: "bg-red-50 border border-red-200 rounded-2xl px-5 py-4 shadow-lg",
  headerWrapper: "flex items-start gap-3",
  textWrapper: "flex-1 min-w-0",
  title: "text-sm font-medium text-red-900 mb-1",
  message: "text-xs text-red-700 break-words",
  actionWrapper: "flex items-center gap-1 flex-shrink-0",
  actionButton: "h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100 transition-all duration-150",
};

// ============ 组件 ============
export interface ErrorNotificationProps {
  show: boolean;
  message: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ErrorNotification({
  show,
  message,
  onRetry,
  onDismiss,
}: ErrorNotificationProps) {
  return (
    <AnimatePresence>
      {show && message && (
        <motion.div
          initial={ERROR_ANIMATION.initial}
          animate={ERROR_ANIMATION.animate}
          exit={ERROR_ANIMATION.exit}
          className={STYLES.container}
        >
          <div className={STYLES.content}>
            <div className={STYLES.headerWrapper}>
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className={STYLES.textWrapper}>
                <div className={STYLES.title}>执行失败</div>
                <div className={STYLES.message}>{message}</div>
              </div>
              <div className={STYLES.actionWrapper}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRetry}
                        className={STYLES.actionButton}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>重试</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDismiss}
                  className={STYLES.actionButton}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
