"use client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { flowAPI } from "@/services/flowAPI";
import type { FlowRecord } from "@/types/flow";
import { Pencil, MoreVertical, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUpdateTime, getNodeCount } from "./flowCardUtils";
import { EditFlowDialog } from "./EditFlowDialog";
import { AvatarDialog } from "./AvatarDialog";
import { IconDisplay } from "./IconDisplay";
import { toast } from "@/hooks/use-toast";

// ============ 常量 ============
const CARD_STYLES = {
  container: "group relative flex flex-col h-[220px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-gray-300",
  header: "mb-3 flex items-start justify-between",
  titleSection: "flex items-center gap-3 flex-1 min-w-0 mr-2",
  iconWrapper: "flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden",
  titleInfo: "flex flex-col min-w-0",
  title: "text-[15px] font-semibold text-gray-900 truncate",
  nodeCount: "flex items-center gap-1 text-xs text-amber-500 font-medium mt-0.5",
  content: "text-sm text-gray-500 line-clamp-2 mt-1",
  footer: "absolute bottom-5 left-5 right-5 text-xs text-gray-400 transition-opacity duration-300 group-hover:opacity-0",
  actionBar: "absolute bottom-0 left-0 flex w-full items-center gap-2 bg-white/95 p-5 backdrop-blur-sm transition-transform duration-300 translate-y-full group-hover:translate-y-0",
};

const BUTTON_STYLES = {
  primary: "bg-black text-white hover:bg-black/90 shadow-sm rounded-xl h-10",
  ghost: "text-gray-500 hover:bg-gray-100 rounded-lg h-10 w-10 flex items-center justify-center",
};

// ============ 攸科什亊 ============

/**
 * 流程操作下拉菜单
 */
function FlowMenu({
  flow,
  onEdit,
  onDelete,
}: {
  flow: FlowRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className={cn("rounded-lg p-2 transition-colors duration-150 hover:bg-gray-100")}>
              <MoreVertical className="w-4 h-4 text-gray-500 hover:text-gray-700" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">更多</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>编辑信息</DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600 focus:bg-red-50 hover:text-red-700 hover:bg-red-50"
          onClick={onDelete}
        >
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 流程信息栏 - 底部更新时间
 */
function FlowFooter({ flow }: { flow: FlowRecord }) {
  return (
    <div className={CARD_STYLES.footer}>
      <span>最近更新：{formatUpdateTime(flow.updated_at)}</span>
    </div>
  );
}

export default function FlowCard({ flow, onUpdated, onDeleted }: { flow: FlowRecord; onUpdated: (f: FlowRecord) => void; onDeleted: (id: string) => void; }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  // ========== 事件处理器 ==========

  const handleDeleteClick = () => {
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await flowAPI.deleteFlow(flow.id);
      onDeleted(flow.id);
      toast({
        title: "删除成功",
        description: `已删除流程「${flow.name}」`,
      });
    } catch (error) {
      console.error("Failed to delete flow:", error);
      toast({
        title: "删除失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleSaveBasic = async (name: string, description: string) => {
    try {
      const updated = await flowAPI.updateFlow(flow.id, { name, description });
      onUpdated(updated);
      toast({
        title: "保存成功",
        description: "流程信息已更新",
      });
    } catch (error) {
      console.error("Failed to save flow:", error);
      toast({
        title: "保存失败",
        description: "无法更新流程信息，请稍后重试",
        variant: "destructive",
      });
      throw error; // 重新抛出以便 EditFlowDialog 知道保存失败
    }
  };

  const handleImageSelect = async (url: string) => {
    try {
      const updated = await flowAPI.updateFlow(flow.id, {
        icon_kind: "image",
        icon_url: url,
        icon_name: null,
      });
      onUpdated(updated);
      toast({
        title: "头像已更新",
      });
    } catch (error) {
      console.error("Failed to update avatar:", error);
      toast({
        title: "更新头像失败",
        description: "请稍后重试",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleEmojiSelect = async (emoji: string) => {
    try {
      const updated = await flowAPI.updateFlow(flow.id, {
        icon_kind: "emoji",
        icon_name: emoji,
        icon_url: null,
      });
      onUpdated(updated);
      toast({
        title: "头像已更新",
      });
    } catch (error) {
      console.error("Failed to update emoji:", error);
      toast({
        title: "更新头像失败",
        description: "请稍后重试",
        variant: "destructive",
      });
      throw error;
    }
  };

  const nodeCount = getNodeCount(flow);

  return (
    <div className={CARD_STYLES.container}>
      {/* Header Area */}
      <div className={CARD_STYLES.header}>
        <div className={CARD_STYLES.titleSection}>
          {/* Circular Icon */}
          <div className={CARD_STYLES.iconWrapper}>
            <IconDisplay flow={flow} className="w-full h-full" isCircular />
          </div>
          {/* Title & Node Count */}
          <div className={CARD_STYLES.titleInfo}>
            <Tooltip open={isTruncated ? undefined : false}>
              <TooltipTrigger asChild>
                <div
                  className={CARD_STYLES.title}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget;
                    setIsTruncated(target.scrollWidth > target.clientWidth);
                  }}
                >
                  {flow.name}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{flow.name}</p>
              </TooltipContent>
            </Tooltip>
            <div className={CARD_STYLES.nodeCount}>
              <Zap className="w-3 h-3" />
              <span>{nodeCount} 节点</span>
            </div>
          </div>
        </div>
        <FlowMenu
          flow={flow}
          onEdit={() => setEditOpen(true)}
          onDelete={handleDeleteClick}
        />
      </div>

      {/* Content Area - Description */}
      <div className={CARD_STYLES.content}>{flow.description || ""}</div>

      {/* Footer Area - Update Time */}
      <FlowFooter flow={flow} />

      {/* Footer Area - Action View (visible on hover) */}
      <div className={CARD_STYLES.actionBar}>
        <Button
          className={BUTTON_STYLES.primary + " flex-1"}
          onClick={() => router.push(`/app?flowId=${flow.id}`)}
        >
          使用
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={BUTTON_STYLES.ghost}
              onClick={() => router.push(`/builder?flowId=${flow.id}`)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">画布编辑</TooltipContent>
        </Tooltip>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>确认删除流程？</DialogTitle>
            <DialogDescription>
              此操作无法撤销。这将永久删除流程 "{flow.name}" 及其所有相关数据。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-4 sm:gap-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <EditFlowDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        flow={flow}
        onAvatarEdit={() => setAvatarOpen(true)}
        onSave={handleSaveBasic}
      />

      {/* Avatar Dialog */}
      <AvatarDialog
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        flowId={flow.id}
        ownerId={flow.owner_id}
        onImageSelect={handleImageSelect}
        onEmojiSelect={handleEmojiSelect}
      />
    </div>
  );
}