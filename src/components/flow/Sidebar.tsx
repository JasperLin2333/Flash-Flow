"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Brain, Search, User, Download, Link, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ============ Types & Constants ============
interface DraggableItemConfig {
  type: string;
  label: string;
  icon: React.ReactElement<{ className?: string }>;
}

interface SidebarSectionConfig {
  title: string;
  items: DraggableItemConfig[];
}

const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    title: "Input / Output",
    items: [
      { type: "input", label: "Input", icon: <User /> },
      { type: "output", label: "Output", icon: <Download /> },
    ],
  },
  {
    title: "AI Capabilities",
    items: [
      { type: "llm", label: "LLM Node", icon: <Brain /> },
      { type: "rag", label: "RAG Search", icon: <Search /> },
    ],
  },
  {
    title: "Integrations",
    items: [
      { type: "http", label: "HTTP Request", icon: <Link /> },
    ],
  },
];

const SIDEBAR_WIDTH = {
  expanded: "w-60",
  collapsed: "w-16",
} as const;

function DraggableItem({ type, label, icon, collapsed }: { type: string; label: string; icon: React.ReactElement<{ className?: string }>; collapsed: boolean }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing transition-all duration-200",
        "hover:bg-gray-100 text-gray-900 hover:text-black",
        collapsed && "justify-center px-2"
      )}
    >
      <div className={cn("w-5 h-5 flex items-center justify-center text-gray-500", collapsed && "w-6 h-6")}>
        {React.cloneElement(icon, { className: "w-4 h-4" })}
      </div>
      {!collapsed && <div className="text-sm font-medium text-gray-900">{label}</div>}
    </div>
  );
}

function SidebarSection({ title, items, collapsed }: { title: string; items: DraggableItemConfig[]; collapsed: boolean }) {
  const [isOpen, setIsOpen] = React.useState(true);

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1">
        <TooltipProvider delayDuration={0}>
          {items.map((item) => (
            <Tooltip key={item.type}>
              <TooltipTrigger asChild>
                <div>
                  <DraggableItem type={item.type} label={item.label} icon={item.icon} collapsed={collapsed} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        className="flex items-center justify-between px-2 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider hover:text-gray-900 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1">
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>{title}</span>
        </div>
        {items.length > 0 && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-semibold">{items.length}</span>}
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 pl-2">
          {items.map((item) => (
            <DraggableItem key={item.type} type={item.type} label={item.label} icon={item.icon} collapsed={false} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded
      )}
    >
      <div className={cn("flex items-center p-4 bg-white border-b border-gray-100", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && <span className="text-sm font-bold text-gray-900">\u7ec4\u4ef6\u5e93</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all duration-150"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
      </div>

      <div className={cn("flex flex-col gap-6 p-4 pt-0 overflow-y-auto", isCollapsed && "px-2 gap-4")}>
        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarSection key={section.title} title={section.title} items={section.items} collapsed={isCollapsed} />
        ))}
      </div>
    </div>
  );
}
