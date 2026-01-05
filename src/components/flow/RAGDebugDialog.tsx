"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import { Play, Search } from "lucide-react";

export default function RAGDebugDialog() {
    const open = useFlowStore((s) => s.activeDialog === 'rag');
    const close = useFlowStore((s) => s.closeDialog);
    const nodeId = useFlowStore((s) => s.activeNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    // Use unified setDialogData but getting specific function is confusing, so let's stick to legacy actions which map to unified ones for simplicity in this component, OR use unified directly.
    // Legacy actions are safer because they are typed in the store interface.
    // But `setRAGDebugInputs` calls `setDialogData`.
    const setDebugInputs = useFlowStore((s) => s.setRAGDebugInputs);
    const confirmRun = useFlowStore((s) => s.confirmRAGDebugRun);

    const [query, setQuery] = useState("");

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            setQuery("");
        }
    }, [open]);

    const handleConfirm = () => {
        if (!query.trim()) return;

        setDebugInputs({
            "query": {
                type: 'text',
                value: query
            }
        });
        confirmRun();
    };

    const currentNode = nodes.find(n => n.id === nodeId);
    const nodeName = currentNode?.data?.label || 'RAG';

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) close(); }}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 shrink-0 bg-white">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        测试节点
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 settings-scrollbar">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700 block">
                            检索语句
                            {!query.trim() && (
                                <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                            )}
                        </Label>
                        <Textarea
                            placeholder="请输入要搜索的内容..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="min-h-[100px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3"
                        />
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                    <Button
                        variant="ghost"
                        onClick={close}
                        className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!query.trim()}
                        className="bg-black text-white hover:bg-black/90 px-6 rounded-lg font-medium shadow-sm transition-all gap-2"
                    >
                        <Play className="w-4 h-4" />
                        运行
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
