"use client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { flowAPI } from "@/services/flowAPI";
import type { FlowRecord } from "@/types/flow";
import { Pencil, MoreVertical, Zap, Globe, FileText, Link as LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { timeAgo, getNodeCount } from "./flowCardUtils";
import { EditFlowDialog } from "./EditFlowDialog";
import { AvatarDialog } from "./AvatarDialog";
import { IconDisplay } from "./IconDisplay";

// ============ 常量 ============
const CARD_STYLES = {
  container: "group relative flex flex-col h-[200px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-gray-300",
  header: "mb-2 flex items-start justify-between",
  content: "text-sm text-gray-500 line-clamp-2",
  footer: "absolute bottom-5 left-5 flex items-center gap-3 text-xs font-medium text-gray-400 transition-opacity duration-300 group-hover:opacity-0",
  actionBar: "absolute bottom-0 left-0 flex w-full items-center justify-between gap-2 bg-white/95 p-5 backdrop-blur-sm transition-transform duration-300 translate-y-full group-hover:translate-y-0",
};

const BUTTON_STYLES = {
  primary: "bg-black text-white hover:bg-black/90 shadow-sm rounded-lg h-9",
  ghost: "text-gray-500 hover:bg-gray-100 rounded-lg h-9 w-9 flex items-center justify-center",
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
      <DropdownMenuTrigger asChild>
        <button className={cn("rounded-lg p-2 transition-colors duration-150 hover:bg-gray-100")}>
          <MoreVertical className="w-4 h-4 text-gray-500 hover:text-gray-700" />
        </button>
      </DropdownMenuTrigger>
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
 * 流程信息栏
 */
function FlowInfo({ flow }: { flow: FlowRecord }) {
  const nodeCount = getNodeCount(flow);

  return (
    <div className={CARD_STYLES.footer}>
      <div>⚡ {nodeCount} 节点</div>
      <div>{timeAgo(flow.updated_at)}</div>
    </div>
  );
}

export default function FlowCard({ flow, onUpdated, onDeleted }: { flow: FlowRecord; onUpdated: (f: FlowRecord) => void; onDeleted: (id: string) => void; }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ========== 事件处理器 ==========

  const handleDeleteClick = () => {
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await flowAPI.deleteFlow(flow.id);
      onDeleted(flow.id);
    } catch (error) {
      console.error("Failed to delete flow:", error);
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleSaveBasic = async (name: string, description: string) => {
    const updated = await flowAPI.updateFlow(flow.id, { name, description });
    onUpdated(updated);
  };

  const handleImageSelect = async (url: string) => {
    const updated = await flowAPI.updateFlow(flow.id, {
      icon_kind: "image",
      icon_url: url,
      icon_name: null,
    });
    onUpdated(updated);
  };

  const handleEmojiSelect = async (emoji: string) => {
    const updated = await flowAPI.updateFlow(flow.id, {
      icon_kind: "emoji",
      icon_name: emoji,
      icon_url: null,
    });
    onUpdated(updated);
  };

  return (
    <div className={CARD_STYLES.container}>
      {/* Header Area */}
      <div className={CARD_STYLES.header}>
        <div className="flex items-center gap-2">
          <IconDisplay flow={flow} className="w-7 h-7" />
          <div className="text-[15px] font-semibold text-gray-900">{flow.name}</div>
        </div>
        <FlowMenu
          flow={flow}
          onEdit={() => setEditOpen(true)}
          onDelete={handleDeleteClick}
        />
      </div>

      {/* Content Area */}
      <div className={CARD_STYLES.content}>{flow.description || ""}</div>

      {/* Footer Area - Meta Info */}
      <FlowInfo flow={flow} />

      {/* Footer Area - Action View */}
      <div className={CARD_STYLES.actionBar}>
        <Button
          className={BUTTON_STYLES.primary + " flex-1"}
          onClick={() => router.push(`/app?flowId=${flow.id}`)}
        >
          使用
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={BUTTON_STYLES.ghost}
          onClick={() => router.push(`/builder?flowId=${flow.id}`)}
        >
          <Pencil className="w-4 h-4" />
        </Button>
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