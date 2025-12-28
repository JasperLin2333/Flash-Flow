"use client";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import type { OutputNodeData, OutputInputMappings, AppNode, FlowState } from "@/types/flow";
import { Play, AlertCircle, Eye } from "lucide-react";

/**
 * Output 节点调试弹窗
 * 允许用户填写 mock 变量值来预览 Output 节点的输出
 */
export default function OutputDebugDialog() {
    const open = useFlowStore((s: FlowState) => s.outputDebugDialogOpen);
    const close = useFlowStore((s: FlowState) => s.closeOutputDebugDialog);
    const nodeId = useFlowStore((s: FlowState) => s.outputDebugNodeId);
    const nodes = useFlowStore((s: FlowState) => s.nodes);
    const setDebugData = useFlowStore((s: FlowState) => s.setOutputDebugData);
    const confirmRun = useFlowStore((s: FlowState) => s.confirmOutputDebugRun);

    const [mockVariables, setMockVariables] = useState<Record<string, string>>({});

    // 获取当前节点和配置
    const currentNode = nodes.find((n: AppNode) => n.id === nodeId);
    const nodeData = currentNode?.data as OutputNodeData | undefined;
    const inputMappings = nodeData?.inputMappings;
    const nodeName = nodeData?.label || 'Output';

    // 解析需要的变量引用（根据当前模式）
    const requiredVariables = useMemo(() => {
        if (!inputMappings) return [];

        const variables: string[] = [];
        const varRegex = /\{\{(.+?)\}\}/g;
        const mode = inputMappings.mode || 'direct';

        // 只有 template 模式才检查 template 字段
        if (mode === 'template' && inputMappings.template) {
            const matches = inputMappings.template.matchAll(varRegex);
            for (const match of matches) {
                if (!variables.includes(match[1])) {
                    variables.push(match[1]);
                }
            }
        }

        // direct, select, merge 模式才检查 sources 字段
        if (mode !== 'template' && inputMappings.sources) {
            for (const source of inputMappings.sources) {
                if (source.type === 'variable' && source.value) {
                    const matches = source.value.matchAll(varRegex);
                    for (const match of matches) {
                        if (!variables.includes(match[1])) {
                            variables.push(match[1]);
                        }
                    }
                }
            }
        }

        // attachments 始终检查（独立于 mode）
        if (inputMappings.attachments) {
            for (const attachment of inputMappings.attachments) {
                if (attachment.type === 'variable' && attachment.value) {
                    const matches = attachment.value.matchAll(varRegex);
                    for (const match of matches) {
                        if (!variables.includes(match[1])) {
                            variables.push(match[1]);
                        }
                    }
                }
            }
        }

        return variables;
    }, [inputMappings]);

    // 当弹窗打开时重置输入
    useEffect(() => {
        if (!open || !nodeId) {
            setMockVariables({});
            return;
        }
        // 初始化 mock 变量为空字符串
        const initial: Record<string, string> = {};
        requiredVariables.forEach(v => {
            initial[v] = '';
        });
        setMockVariables(initial);
    }, [open, nodeId, requiredVariables]);

    const handleVariableChange = (varName: string, value: string) => {
        setMockVariables(prev => ({
            ...prev,
            [varName]: value
        }));
    };

    const handleConfirm = () => {
        setDebugData({ mockVariables });
        confirmRun();
    };

    // 获取输出模式的中文描述
    const getModeLabel = (mode?: string) => {
        switch (mode) {
            case 'direct': return '直接引用';
            case 'select': return '分支选择';
            case 'merge': return '内容合并';
            case 'template': return '模板渲染';
            default: return '直接引用';
        }
    };

    const hasVariables = requiredVariables.length > 0;
    const allFilled = requiredVariables.every(v => mockVariables[v]?.trim());

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) close(); }}>
            <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-bold text-base">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        测试 Output 节点
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        正在调试节点 <span className="font-semibold text-gray-700">{nodeName}</span>
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
                            {getModeLabel(inputMappings?.mode)}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Mock 变量输入 */}
                    {hasVariables ? (
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">填写测试变量</div>
                            <div className="space-y-2">
                                {requiredVariables.map((varName) => (
                                    <div key={varName} className="space-y-1">
                                        <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                            <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">{`{{${varName}}}`}</code>
                                            {!mockVariables[varName]?.trim() && (
                                                <span className="text-red-500 text-[10px]">(必填)</span>
                                            )}
                                        </Label>
                                        <Input
                                            placeholder={`输入 ${varName} 的测试值...`}
                                            value={mockVariables[varName] || ''}
                                            onChange={(e) => handleVariableChange(varName, e.target.value)}
                                            className={`text-sm placeholder:text-sm placeholder:text-gray-400 ${!mockVariables[varName]?.trim()
                                                ? 'border-red-200 focus:border-red-400'
                                                : 'border-gray-200'
                                                }`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400">
                            <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">此配置不需要变量输入</p>
                            <p className="text-xs mt-1">可直接运行测试</p>
                        </div>
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
                        disabled={hasVariables && !allFilled}
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
