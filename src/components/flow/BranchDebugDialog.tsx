"use client";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import { Loader2, AlertCircle, CheckCircle2, Play } from "lucide-react";
import { validateCondition } from "@/lib/branchConditionParser";

export default function BranchDebugDialog() {
    // Use unified dialog API
    const open = useFlowStore((s) => s.activeDialog === 'branch');
    const nodeId = useFlowStore((s) => s.activeNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    const closeDialog = useFlowStore((s) => s.closeDialog);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const confirmDialogRun = useFlowStore((s) => s.confirmDialogRun);

    const [conditionValue, setConditionValue] = useState("");
    const [isRunning, setIsRunning] = useState(false);

    const currentNode = nodes.find(n => n.id === nodeId);

    const validationResult = useMemo(() => {
        if (!conditionValue || !conditionValue.trim()) {
            return { valid: false, error: "请输入判断条件" };
        }
        return validateCondition(conditionValue);
    }, [conditionValue]);

    // 当弹窗打开时重置输入
    useEffect(() => {
        if (!open || !nodeId) {
            setConditionValue("");
            setIsRunning(false);
            return;
        }
        // 如果节点已有条件，预填充
        const currentCondition = currentNode?.data?.condition as string;
        if (currentCondition) {
            setConditionValue(currentCondition);
        } else {
            setConditionValue("");
        }
    }, [open, nodeId, currentNode]);

    const handleConfirm = async () => {
        if (!nodeId) return;
        if (!conditionValue.trim() || !validationResult.valid) return;

        setIsRunning(true);
        try {
            // 保存条件到节点数据
            updateNodeData(nodeId, { condition: conditionValue });

            // 使用统一的 confirmDialogRun 执行（包含关闭弹窗和运行节点逻辑）
            await confirmDialogRun();
        } catch (e) {
            console.error("Run failed:", e);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && !isRunning && closeDialog()}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100 shrink-0 bg-white">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        测试节点
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 settings-scrollbar">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700 block">
                            判断条件 (condition)
                            <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                        </Label>
                        <Textarea
                            placeholder='例如：Input.user_input.includes("error") || LLM.response.startsWith("Yes")'
                            value={conditionValue}
                            onChange={(e) => setConditionValue(e.target.value)}
                            className={`min-h-[120px] text-sm font-mono resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3 ${!validationResult.valid ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
                            disabled={isRunning}
                        />
                        {validationResult.valid ? (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                {conditionValue?.trim() && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                <span>支持: .includes(), .startsWith(), .endsWith(), ===, &gt;, &lt;, &&, ||</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{validationResult.error}</span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                    <Button
                        variant="ghost"
                        onClick={closeDialog}
                        disabled={isRunning}
                        className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isRunning || !conditionValue.trim() || !validationResult.valid}
                        className="bg-black text-white hover:bg-black/90 px-6 rounded-lg font-medium shadow-sm transition-all gap-2"
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> 运行</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
