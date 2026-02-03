"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFlowStore } from "@/store/flowStore";
import type { DebugInputs, LLMNodeData } from "@/types/flow";
import { Loader2, Play } from "lucide-react";

export default function LLMDebugDialog() {
    // Use unified dialog API
    const open = useFlowStore((s) => s.activeDialog === 'llm');
    const nodeId = useFlowStore((s) => s.activeNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    const closeDialog = useFlowStore((s) => s.closeDialog);
    const setDialogData = useFlowStore((s) => s.setDialogData);
    const confirmDialogRun = useFlowStore((s) => s.confirmDialogRun);

    const [systemPrompt, setSystemPrompt] = useState("");
    const [userInput, setUserInput] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [useMockOutput, setUseMockOutput] = useState(false);
    const [mockResponse, setMockResponse] = useState("");
    const [mockReasoning, setMockReasoning] = useState("");

    const currentNode = nodes.find(n => n.id === nodeId);
    const nodeData = currentNode?.data as LLMNodeData | undefined;

    // Reset/Load data when dialog opens
    useEffect(() => {
        if (open && nodeData) {
            setSystemPrompt(nodeData.systemPrompt || "");
            const mappingInput = nodeData?.inputMappings?.user_input;
            setUserInput(mappingInput || "");
        } else if (!open) {
            // Clear on close
            setSystemPrompt("");
            setUserInput("");
            setIsRunning(false);
            setUseMockOutput(false);
            setMockResponse("");
            setMockReasoning("");
        }
    }, [open, nodeId, nodeData]);

    const handleConfirm = async () => {
        setIsRunning(true);
        // Construct debug inputs
        const debugInputs: DebugInputs = {
            systemPrompt: {
                type: 'text',
                value: systemPrompt
            },
            user_input: {
                type: 'text',
                value: userInput
            }
        };

        if (useMockOutput) {
            debugInputs.__ff_mock_mode = { type: "text", value: "true" };
            debugInputs.__ff_mock_response = { type: "text", value: mockResponse };
            debugInputs.__ff_mock_reasoning = { type: "text", value: mockReasoning };
        }

        setDialogData(debugInputs);
        await confirmDialogRun();
        setIsRunning(false);
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
                            系统提示词
                            <span className="text-gray-400 ml-2 text-xs font-normal">(可选)</span>
                        </Label>
                        <Textarea
                            placeholder="请输入系统提示词..."
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="min-h-[100px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3"
                            disabled={isRunning}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700 block">
                            用户输入
                            <span className="text-gray-400 ml-2 text-xs font-normal">(可选)</span>
                        </Label>
                        <Textarea
                            placeholder="请输入用户输入..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            className="min-h-[100px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3"
                            disabled={isRunning}
                        />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="space-y-0.5">
                                <div className="text-sm font-medium text-gray-900">使用 Mock 输出</div>
                                <div className="text-xs text-gray-500">不调用服务端，不扣积分；用于验证下游链路与变量引用</div>
                            </div>
                            <Switch
                                checked={useMockOutput}
                                onCheckedChange={setUseMockOutput}
                                disabled={isRunning}
                            />
                        </div>

                        {useMockOutput && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700 block">Mock Response</Label>
                                    <Textarea
                                        placeholder="请输入模拟的 LLM response（将写入输出.response）"
                                        value={mockResponse}
                                        onChange={(e) => setMockResponse(e.target.value)}
                                        className="min-h-[100px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3 bg-white"
                                        disabled={isRunning}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700 block">Mock Reasoning (可选)</Label>
                                    <Textarea
                                        placeholder="请输入模拟的 reasoning（将写入输出.reasoning）"
                                        value={mockReasoning}
                                        onChange={(e) => setMockReasoning(e.target.value)}
                                        className="min-h-[80px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3 bg-white"
                                        disabled={isRunning}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                    <Button variant="ghost" onClick={closeDialog} disabled={isRunning} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                        取消
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isRunning}
                        className="bg-black text-white hover:bg-black/90 px-6 rounded-lg font-medium shadow-sm transition-all"
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> 运行</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
