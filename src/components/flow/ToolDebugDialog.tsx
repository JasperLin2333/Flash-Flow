"use client";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFlowStore } from "@/store/flowStore";
import { Loader2, Play } from "lucide-react";
import { TOOL_REGISTRY, DEFAULT_TOOL_TYPE, DATETIME_OPERATIONS, TIME_UNIT_OPTIONS, type ToolType } from "@/lib/tools/registry";
import type { ToolNodeData, AppNode } from "@/types/flow";
import { z } from "zod";
import { showError } from "@/utils/errorNotify";
import { formatFieldLabel } from "@/lib/tools/toolFieldNames";
import { CodeInterpreterFileUpload, type CodeFileItem } from "./tool-inputs/CodeInterpreterFileUpload";

export default function ToolDebugDialog() {
    // Use unified dialog API
    const open = useFlowStore((s) => s.activeDialog === 'tool');
    const nodeId = useFlowStore((s) => s.activeNodeId);
    const nodes = useFlowStore((s) => s.nodes);
    const closeDialog = useFlowStore((s) => s.closeDialog);
    const setDialogData = useFlowStore((s) => s.setDialogData);
    const confirmDialogRun = useFlowStore((s) => s.confirmDialogRun);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);

    const [inputValues, setInputValues] = useState<Record<string, any>>({});
    const [isRunning, setIsRunning] = useState(false);

    const currentNode = nodes.find(n => n.id === nodeId) as AppNode | undefined;
    const nodeData = currentNode?.data as ToolNodeData | undefined;

    // Explicitly cast toolType and provide fallback
    const toolType = (nodeData?.toolType as ToolType) || DEFAULT_TOOL_TYPE;
    const toolConfig = TOOL_REGISTRY[toolType];

    // Parse schema fields
    const schemaFields = useMemo(() => {
        if (!toolConfig?.schema) return [];

        const schema = toolConfig.schema as any;
        const def = schema._def;

        // Handle Discriminated Union (checking for discriminator property)
        if (def && 'discriminator' in def) {
            const discriminator = def.discriminator;
            const options = def.options;
            const optionsMap = def.optionsMap;

            // Get current value of discriminator (e.g. 'operation')
            const currentDiscriminatorValue = inputValues[discriminator];

            let selectedSchema = null;

            // 1. Try to get specific schema for current value
            if (currentDiscriminatorValue) {
                if (optionsMap?.get) {
                    selectedSchema = optionsMap.get(currentDiscriminatorValue);
                } else if (options) {
                    selectedSchema = options.find((opt: any) =>
                        opt.shape?.[discriminator]?.value === currentDiscriminatorValue ||
                        opt.shape?.[discriminator]?._def?.value === currentDiscriminatorValue // Handle different Zod versions of ZodLiteral
                    );
                }
            }

            // 2. Fallback: Use the default (first) option if no match found
            // This ensures we always render something (e.g. 'now' operation fields)
            if (!selectedSchema && options && options.length > 0) {
                selectedSchema = options[0];
            }

            if (!selectedSchema || !selectedSchema.shape) return [];

            return Object.entries(selectedSchema.shape).map(([key, value]) => ({
                name: key,
                schema: value as z.ZodTypeAny,
                isOptional: (value as z.ZodTypeAny).isOptional(),
                description: (value as any).description || key
            }));
        }

        // Handle Standard Object
        // Check if it has .shape (ZodObject)
        if (schema.shape) {
            return Object.entries(schema.shape).map(([key, value]) => ({
                name: key,
                schema: value as z.ZodTypeAny,
                isOptional: (value as z.ZodTypeAny).isOptional(),
                description: (value as any).description || key
            }));
        }

        // Check if _def.shape exists (fallback)
        if (def?.shape) {
            return Object.entries(def.shape).map(([key, value]) => ({
                name: key,
                schema: value as z.ZodTypeAny,
                isOptional: (value as z.ZodTypeAny).isOptional(),
                description: (value as any).description || key
            }));
        }

        return [];
    }, [toolConfig, inputValues]);

    // Reset and Load data when dialog opens
    useEffect(() => {
        if (open && nodeData) {
            // Load existing inputs from node data or use empty object
            const existingInputs = (nodeData.inputs as Record<string, any>) || {};
            setInputValues(existingInputs);
            setIsRunning(false);
        } else if (!open) {
            // Clear on close
            setInputValues({});
            setIsRunning(false);
        }
    }, [open, nodeId, nodeData]);

    const handleInputChange = (name: string, value: any) => {
        setInputValues(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle file changes from CodeInterpreterFileUpload component
    const handleFilesChange = (files: CodeFileItem[]) => {
        setInputValues(prev => ({
            ...prev,
            inputFiles: files
        }));
        if (nodeId) {
            updateNodeData(nodeId, {
                inputs: {
                    ...inputValues,
                    inputFiles: files
                }
            });
        }
    };

    const handleConfirm = async () => {
        setIsRunning(true);





        // 2. Prepare debug inputs
        const debugInputs: Record<string, any> = {};

        // Get list of valid field names for current schema
        const validFieldNames = new Set(schemaFields.map(f => f.name));

        Object.entries(inputValues).forEach(([key, value]) => {
            // Only include fields that are part of the current schema
            if (!validFieldNames.has(key)) return;

            // Ensure we don't send empty strings for any field
            // z.coerce.number() will convert "" to 0, which might fail validation (e.g. min(1))
            // So we strictly filter out empty strings
            if (value === "" || value === undefined || value === null) return;

            if (typeof value === 'string') {
                if (value.trim()) debugInputs[key] = value;
            } else {
                debugInputs[key] = value;
            }
        });

        setDialogData(debugInputs);

        // 1. Update node data final sync (using CLEANED inputs)
        // This prevents saving "" to node data which would override the debug inputs during execution merge
        if (nodeId) {
            updateNodeData(nodeId, {
                inputs: debugInputs
            });
        }
        try {
            await confirmDialogRun();
        } catch (error) {
            console.error("Test execution failed:", error);
            showError("运行失败", error instanceof Error ? error.message : "未知错误");
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
                    {schemaFields.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-500">
                            该工具无需输入参数
                        </div>
                    ) : (
                        schemaFields.map((field) => {

                            const val = inputValues[field.name];

                            // 1. Datetime Operation Select
                            if (toolType === 'datetime' && field.name === 'operation') {
                                return (
                                    <div key={field.name} className="space-y-2">
                                        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                            {formatFieldLabel(field.name)}
                                            <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                                        </Label>
                                        <Select
                                            value={val || "now"}
                                            onValueChange={(v) => handleInputChange(field.name, v)}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue placeholder="Select operation" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DATETIME_OPERATIONS.map((op) => (
                                                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            }

                            // 2. Datetime Unit Select
                            if (toolType === 'datetime' && field.name === 'unit') {
                                return (
                                    <div key={field.name} className="space-y-2">
                                        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                            {formatFieldLabel(field.name)}
                                            {/* unit is optional in schema but logically required for ad/diff */}
                                            <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                                        </Label>
                                        <Select
                                            value={val || "day"}
                                            onValueChange={(v) => handleInputChange(field.name, v)}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue placeholder="Select unit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TIME_UNIT_OPTIONS.map((unit) => (
                                                    <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            }

                            // 3. Code Interpreter File Upload
                            if (toolType === 'code_interpreter' && field.name === 'inputFiles' && nodeId) {
                                const currentFiles = (val as CodeFileItem[]) || [];
                                return (
                                    <CodeInterpreterFileUpload
                                        key={field.name}
                                        nodeId={nodeId}
                                        files={currentFiles}
                                        onFilesChange={handleFilesChange}
                                        isOptional={field.isOptional}
                                        disabled={isRunning}
                                    />
                                );
                            }

                            // 4. Default Input/Textarea Render
                            // Check if schema is ZodNumber or ZodEffects (coercion) wrapping ZodNumber
                            const schemaDef = (field.schema as any)._def;
                            const isNumber =
                                schemaDef.typeName === "ZodNumber" ||
                                (schemaDef.typeName === "ZodEffects" && schemaDef.schema?._def?.typeName === "ZodNumber");

                            return (
                                <div key={field.name} className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                        {formatFieldLabel(field.name)}
                                        {!field.isOptional && (
                                            <span className="text-gray-400 ml-2 text-xs font-normal">(必填)</span>
                                        )}
                                        {field.isOptional && (
                                            <span className="text-gray-400 ml-2 text-xs font-normal">(可选)</span>
                                        )}
                                    </Label>

                                    {isNumber ? (
                                        <Input
                                            type="number"
                                            placeholder={field.description}
                                            value={val ?? ''}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                            className="focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg"
                                            disabled={isRunning}
                                        />
                                    ) : (
                                        <Textarea
                                            placeholder={field.description}
                                            value={val || ''}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                            className="min-h-[120px] text-sm resize-none focus-visible:ring-1 focus-visible:ring-black border-gray-200 rounded-lg p-3"
                                            disabled={isRunning}
                                        />
                                    )}
                                </div>
                            );
                        })
                    )}
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
                        disabled={isRunning}
                        className="bg-black text-white hover:bg-black/90 px-6 rounded-lg font-medium shadow-sm transition-all gap-2"
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> 运行</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
