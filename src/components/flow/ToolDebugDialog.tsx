"use client";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowStore } from "@/store/flowStore";
import { Play, Wrench } from "lucide-react";
import { TOOL_REGISTRY, type ToolType } from "@/lib/tools/registry";
import type { ToolNodeData, AppNode } from "@/types/flow";
import { z } from "zod";

export default function ToolDebugDialog() {
    const open = useFlowStore((s) => s.toolDebugDialogOpen);
    const close = useFlowStore((s) => s.closeToolDebugDialog);
    const nodeId = useFlowStore((s) => s.toolDebugNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    const setDebugInputs = useFlowStore((s) => s.setToolDebugInputs);
    const confirmRun = useFlowStore((s) => s.confirmToolDebugRun);

    const [inputValues, setInputValues] = useState<Record<string, string>>({});

    const currentNode = nodes.find(n => n.id === nodeId) as AppNode | undefined;
    const nodeData = currentNode?.data as ToolNodeData | undefined;
    const toolType = (nodeData?.toolType as ToolType) || "web_search";
    const toolConfig = TOOL_REGISTRY[toolType];

    // Parse schema fields
    const schemaFields = useMemo(() => {
        if (!toolConfig?.schema) return [];

        const shape = (toolConfig.schema as z.ZodObject<any>)._def.shape;
        if (!shape) return [];

        return Object.entries(shape).map(([key, value]) => ({
            name: key,
            schema: value as z.ZodTypeAny,
            isOptional: (value as z.ZodTypeAny).isOptional(),
            description: (value as any).description || key
        }));
    }, [toolConfig]);

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            setInputValues({});
        }
    }, [open]);

    const handleInputChange = (name: string, value: string) => {
        setInputValues(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleConfirm = () => {
        // Check required fields
        const missingRequired = schemaFields.some(field =>
            !field.isOptional && !inputValues[field.name]?.trim()
        );

        if (missingRequired) return;

        // 将输入值转换为简单的 key-value 格式，供 ToolNodeExecutor 使用
        const debugInputs: Record<string, string> = {};
        Object.entries(inputValues).forEach(([key, value]) => {
            if (value.trim()) {
                debugInputs[key] = value;
            }
        });

        setDebugInputs(debugInputs);
        confirmRun();
    };

    const nodeName = currentNode?.data?.label || '工具';

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) close(); }}>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-bold text-base">
                        <Wrench className="w-5 h-5 text-purple-600" />
                        填写测试数据
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        正在调试节点 <span className="font-semibold text-gray-700">{nodeName}</span> ({toolConfig?.name})
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                    {schemaFields.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-500">
                            该工具无需输入参数
                        </div>
                    ) : (
                        schemaFields.map((field) => {
                            const isEmpty = !field.isOptional && !inputValues[field.name]?.trim();

                            return (
                                <div key={field.name} className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        {field.name}
                                        {isEmpty && (
                                            <span className="text-xs text-red-600 font-medium">(必填)</span>
                                        )}
                                        {field.isOptional && (
                                            <span className="text-xs text-gray-400 font-normal">(选填)</span>
                                        )}
                                    </Label>
                                    <Input
                                        placeholder={field.description}
                                        value={inputValues[field.name] || ''}
                                        onChange={(e) => handleInputChange(field.name, e.target.value)}
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
                        disabled={schemaFields.some(field => !field.isOptional && !inputValues[field.name]?.trim())}
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
