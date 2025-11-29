"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FlowRecord } from "@/types/flow";
import { IconDisplay } from "./IconDisplay";
import React from "react";

// ============ 常量 ============
const DIALOG_STYLE = {
  content: "sm:max-w-[520px] rounded-2xl border border-gray-200 shadow-xl",
};

const BUTTON_STYLE = {
  primary: "bg-black text-white hover:bg-black/90 active:bg-black/95 font-semibold transition-colors duration-150",
  secondary: "border-gray-200 text-gray-900 hover:bg-gray-50",
};

// ============ 组件 ============
export interface EditFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flow: FlowRecord;
  onAvatarEdit: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

interface EditFormState {
  name: string;
  description: string;
}

export function EditFlowDialog({
  open,
  onOpenChange,
  flow,
  onAvatarEdit,
  onSave,
}: EditFlowDialogProps) {
  const [formState, setFormState] = React.useState<EditFormState>({
    name: flow.name,
    description: flow.description || "",
  });
  const [isSaving, setIsSaving] = React.useState(false);

  // 重置表单（当对话框打开时）
  React.useEffect(() => {
    if (open) {
      setFormState({
        name: flow.name,
        description: flow.description || "",
      });
    }
  }, [open, flow]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formState.name, formState.description);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_STYLE.content}>
        <DialogHeader>
          <DialogTitle className="font-bold text-base">编辑工作流</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            修改基本信息或更换头像
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 头像编辑按钮 */}
          <div className="flex items-center gap-3">
            <button
              className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-colors"
              onClick={onAvatarEdit}
            >
              {/* 头像渲染 */}
              <IconDisplay flow={flow} className="w-7 h-7" />
            </button>
            <div className="text-xs text-gray-500">点击头像进行更换</div>
          </div>

          {/* 名称输入 */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">名称</div>
            <Input
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />
          </div>

          {/* 摘要输入 */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">摘要</div>
            <Textarea
              value={formState.description}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="min-h-[100px]"
            />
          </div>

          {/* 按钮组 */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={BUTTON_STYLE.secondary}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button
              className={BUTTON_STYLE.primary}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
