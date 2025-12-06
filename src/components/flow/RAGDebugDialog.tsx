"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import { Play, Search } from "lucide-react";

export default function RAGDebugDialog() {
    const open = useFlowStore((s) => s.ragDebugDialogOpen);
    const close = useFlowStore((s) => s.closeRAGDebugDialog);
    const nodeId = useFlowStore((s) => s.ragDebugNodeId);
    const nodes = useFlowStore((s) => s.nodes);
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
            <DialogContent className="sm:max-w-[500px] rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-bold text-base">
                        <Search className="w-5 h-5 text-blue-600" />
                        填写测试数据
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        正在调试节点 <span className="font-semibold text-gray-700">{nodeName}</span>，请输入检索语句
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            检索语句
                            {!query.trim() && (
                                <span className="text-xs text-red-600 font-medium">(必填)</span>
                            )}
                        </Label>
                        <Input
                            placeholder="请输入要搜索的内容..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className={`transition-all duration-150 ${!query.trim()
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                : 'border-gray-200'
                                }`}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={close}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!query.trim()}
                        className="gap-2 bg-black text-white hover:bg-black/85 active:bg-black/95 font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="w-3 h-3" />
                        运行测试
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
