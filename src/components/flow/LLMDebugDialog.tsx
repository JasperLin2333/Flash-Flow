"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import type { DebugInputs } from "@/types/flow";
import { Play, AlertCircle } from "lucide-react";

export default function LLMDebugDialog() {
    const open = useFlowStore((s) => s.llmDebugDialogOpen);
    const close = useFlowStore((s) => s.closeLLMDebugDialog);
    const nodeId = useFlowStore((s) => s.llmDebugNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    const setDebugInputs = useFlowStore((s) => s.setLLMDebugInputs);
    const confirmRun = useFlowStore((s) => s.confirmLLMDebugRun);

    const [userInputValue, setUserInputValue] = useState("");

    // 当弹窗打开时重置输入
    useEffect(() => {
        if (!open || !nodeId) {
            setUserInputValue("");
            return;
        }
        setUserInputValue("");
    }, [open, nodeId]);

    const handleConfirm = () => {
        // 检查 user_input 是否已填写
        if (!userInputValue.trim()) {
            return;
        }

        // 转换为扩展性数据结构
        const debugInputs: DebugInputs = {
            user_input: {
                type: 'text',
                value: userInputValue
            }
        };

        setDebugInputs(debugInputs);
        confirmRun();
    };

    const currentNode = nodes.find(n => n.id === nodeId);
    const nodeName = currentNode?.data?.label || 'LLM';
    const isEmpty = !userInputValue.trim();

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) close(); }}>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-bold text-base">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        填写测试数据
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        正在调试节点 <span className="font-semibold text-gray-700">{nodeName}</span>，请填写测试输入
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            user_prompt
                            {isEmpty && (
                                <span className="text-xs text-red-600 font-medium">(必填)</span>
                            )}
                        </Label>
                        <Input
                            placeholder="请输入用户消息内容..."
                            value={userInputValue}
                            onChange={(e) => setUserInputValue(e.target.value)}
                            className={`transition-all duration-150 ${isEmpty
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                : 'border-gray-200'
                                }`}
                        />
                        <p className="text-xs text-gray-400">
                            这是 LLM 节点所需的用户输入，对应"需要的上游输入"中的 user_prompt 字段
                        </p>
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
                        disabled={isEmpty}
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
