"use client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/store/flowStore";
import type { AppNode, InputNodeData, FlowState } from "@/types/flow";
import { AlertCircle } from "lucide-react";

export default function InputPromptDialog() {
    const open = useFlowStore((s: FlowState) => s.inputPromptOpen);
    const close = useFlowStore((s: FlowState) => s.closeInputPrompt);
    const confirmRun = useFlowStore((s: FlowState) => s.confirmInputRun);
    const nodes = useFlowStore((s: FlowState) => s.nodes);
    const updateNodeData = useFlowStore((s: FlowState) => s.updateNodeData);

    // Get all input nodes
    const inputNodes = nodes.filter((n: AppNode) => n.type === 'input');

    const handleConfirm = () => {
        // Check if all inputs are filled
        const allFilled = inputNodes.every((n: AppNode) => {
            const data = n.data as InputNodeData;
            return data.text && data.text.trim();
        });

        if (!allFilled) {
            // Don't close if not all filled - user will see warning
            return;
        }

        confirmRun();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && close()}>
            <DialogContent className="sm:max-w-[520px] rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-bold text-base">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        填写输入数据
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        请为以下输入节点填写数据后再运行流程
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {inputNodes.map((node: AppNode) => {
                        const data = node.data as InputNodeData;
                        const isEmpty = !data.text || !data.text.trim();

                        return (
                            <div key={node.id} className="space-y-2">
                                <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    {(data.label as string) || 'Input'}
                                    {isEmpty && (
                                        <span className="text-xs text-red-600 font-medium">(必填)</span>
                                    )}
                                </label>
                                <Textarea
                                    placeholder="请输入数据..."
                                    value={data.text || ''}
                                    onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                                    className={`min-h-[100px] resize-none transition-all duration-150 ${isEmpty ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200'}`}
                                />
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={close} className="border-gray-300 text-gray-700 hover:bg-gray-50">取消</Button>
                    <Button
                        onClick={handleConfirm}
                        className="bg-black text-white hover:bg-black/85 active:bg-black/95 font-semibold transition-colors duration-150"
                    >
                        确认运行
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
