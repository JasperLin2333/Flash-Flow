"use client";
import { useState } from "react";
import Sidebar from "@/components/flow/Sidebar";
import FlowCanvas from "@/components/flow/FlowCanvas";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Pencil, Check, X } from "lucide-react";
import { useFlowStore } from "@/store/flowStore";
import { useRouter } from "next/navigation";

export default function BuilderPage() {
  const router = useRouter();
  const saveStatus = useFlowStore((s) => s.saveStatus);
  const flowTitle = useFlowStore((s) => s.flowTitle);
  const setFlowTitle = useFlowStore((s) => s.setFlowTitle);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(flowTitle);

  const handleStartEdit = () => {
    setTempTitle(flowTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      setFlowTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setTempTitle(flowTitle);
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="h-14 bg-white border-b border-gray-200 px-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/flows")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="flex-1 flex items-center justify-center gap-2">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="text-sm text-gray-900 font-medium px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveTitle}>
                <Check className="w-4 h-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit}>
                <X className="w-4 h-4 text-gray-500" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <div className="text-sm text-gray-900 font-medium">{flowTitle}</div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleStartEdit}
              >
                <Pencil className="w-3 h-3 text-gray-500" />
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 mr-2">{saveStatus === "saving" ? "正在保存…" : "已保存"}</div>
        <div className="ml-auto flex items-center gap-2">
          <Button className="gap-2 bg-black hover:bg-black/90 text-white"><Save className="w-4 h-4" />保存</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <FlowCanvas />
      </div>
    </div>
  );
}
