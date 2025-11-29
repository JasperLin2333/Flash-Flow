"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import { extractVariables } from "@/lib/promptParser";
import type { AppNode, LLMNodeData, DebugInputs } from "@/types/flow";
import { Play, AlertCircle } from "lucide-react";

export default function LLMDebugDialog() {
    const open = useFlowStore((s) => s.llmDebugDialogOpen);
    const close = useFlowStore((s) => s.closeLLMDebugDialog);
    const nodeId = useFlowStore((s) => s.llmDebugNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    const setDebugInputs = useFlowStore((s) => s.setLLMDebugInputs);
    const confirmRun = useFlowStore((s) => s.confirmLLMDebugRun);

    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [variables, setVariables] = useState<string[]>([]);

    // 当弹窗打开或节点ID变化时，提取变量
    useEffect(() => {
        if (!open || !nodeId) {
            setVariables([]);
            setInputValues({});
            return;
        }

        const node = nodes.find(n => n.id === nodeId) as AppNode | undefined;
        if (!node || node.type !== 'llm') {
            setVariables([]);
            return;
        }

        const llmData = node.data as LLMNodeData;
        const systemPrompt = llmData.systemPrompt || '';
        const extractedVars = extractVariables(systemPrompt);

        setVariables(extractedVars);

        // 初始化输入值
        const initialValues: Record<string, string> = {};
        extractedVars.forEach(v => {
            initialValues[v] = '';
        });
        setInputValues(initialValues);
    }, [open, nodeId, nodes]);

    const handleInputChange = (varName: string, value: string) => {
        setInputValues(prev => ({
            ...prev,
            [varName]: value
        }));
    };

    const handleConfirm = () => {
        // 检查是否所有变量都已填写
        const allFilled = variables.every(v => inputValues[v]?.trim());

        if (!allFilled) {
            // 可以添加更友好的错误提示
            return;
        }

        // 转换为扩展性数据结构
        const debugInputs: DebugInputs = {};
        Object.entries(inputValues).forEach(([key, value]) => {
            debugInputs[key] = {
                type: 'text',
                value
            };
        });

        setDebugInputs(debugInputs);
        confirmRun();
    };

    const currentNode = nodes.find(n => n.id === nodeId);
    const nodeName = currentNode?.data?.label || 'LLM';

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) close(); }}>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-bold text-base">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        填写测试数据
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        正在调试节点 <span className="font-semibold text-gray-700">{nodeName}</span>，请为以下变量填写测试值
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                    {variables.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-500">
                            当前 Prompt 中没有检测到变量
                            <div className="mt-2 text-xs text-gray-400">
                                变量格式示例: {`{{user_input}}`}
                            </div>
                        </div>
                    ) : (
                        variables.map((varName) => {
                            const isEmpty = !inputValues[varName]?.trim();

                            return (
                                <div key={varName} className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        {varName}
                                        {isEmpty && (
                                            <span className="text-xs text-red-600 font-medium">(必填)</span>
                                        )}
                                    </Label>
                                    <Input
                                        placeholder={`请输入 ${varName} 的测试值...`}
                                        value={inputValues[varName] || ''}
                                        onChange={(e) => handleInputChange(varName, e.target.value)}
                                        className={`transition-all duration-150 ${isEmpty
                                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                                                : 'border-gray-200'
                                            }`}
                                    />
                                </div>
                            );
                        })
                    )}
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
                        disabled={variables.length === 0 || !variables.every(v => inputValues[v]?.trim())}
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
