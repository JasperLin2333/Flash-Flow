"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp, Loader2, Trash2, Palette, SlidersHorizontal, ImagePlus, Scaling, MessageSquareX } from "lucide-react";
import { fileUploadService } from "@/services/fileUploadService";
import { useFlowStore } from "@/store/flowStore";
import { showError } from "@/utils/errorNotify";
import { NODE_FORM_STYLES, type ExtendedNodeFormProps, CapabilityItem } from "./shared";
import type { AppNode } from "@/types/flow";
import { useImageGenModel } from "@/hooks/useImageGenModel";
import { IMAGEGEN_CONFIG, IMAGEGEN_SIZE_NAMES } from "@/store/constants/imageGenConstants";
import { ImageSlotUploader } from "./components/ImageSlotUploader";

const STYLES = NODE_FORM_STYLES;

function getSizeAspectValue(size: string | undefined | null): number | null {
    if (!size) return null;
    const [wRaw, hRaw] = String(size).split("x");
    const w = Number(wRaw);
    const h = Number(hRaw);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return w / h;
}

interface ImageGenNodeFormProps extends ExtendedNodeFormProps {
    selectedNode?: AppNode;
}

export function ImageGenNodeForm({ form, selectedNodeId, updateNodeData, selectedNode: _selectedNode }: ImageGenNodeFormProps) {
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
    const fileInputRef1 = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);
    const fileInputRef3 = useRef<HTMLInputElement>(null);
    const [showExtraImages, setShowExtraImages] = useState<number>(0);
    
    // UI States for CapabilityItems
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showNegativePrompt, setShowNegativePrompt] = useState(false);
    const [, setShowReferenceImage] = useState(false);
    
    // Initialize showNegativePrompt based on value existence
    useEffect(() => {
        const negativePrompt = form.getValues("negativePrompt");
        if (negativePrompt) {
            setShowNegativePrompt(true);
        }
    }, [form]);

    // Initialize showReferenceImage based on value existence
    useEffect(() => {
        const refImg1 = form.getValues("referenceImageUrl");
        const refImgVar = form.getValues("referenceImageVariable");
        if (refImg1 || refImgVar) {
            setShowReferenceImage(true);
        }
    }, [form]);

    const currentFlowId = useFlowStore((s) => s.currentFlowId);

    const selectedModelId = useWatch({
        control: form.control,
        name: "model",
        defaultValue: "",
    });

    const {
        models,
        loading: modelsLoading,
        error: modelsError,
        capabilities: modelCapabilities,
        stepRange,
        cfgRange,
        sizeOptions,
        getModelDisplayName,
        refetchModels: loadModels,
        calculateQuality: hookCalculateQuality,
        calculateSteps: hookCalculateSteps,
        calculateCfgQuality: hookCalculateCfgQuality,
        calculateCfgValue: hookCalculateCfgValue,
    } = useImageGenModel(selectedModelId);

    const currentSteps = useWatch({
        control: form.control,
        name: "numInferenceSteps",
        defaultValue: modelCapabilities.defaultSteps ?? 25,
    });

    useEffect(() => {
        if (modelCapabilities.supportsReferenceImage) {
            setShowReferenceImage(true);
        }
    }, [modelCapabilities.supportsReferenceImage]);

    useEffect(() => {
        const currentSize = form.getValues("imageSize");
        if (modelCapabilities.supportsImageSize === false) {
            if (currentSize) {
                form.setValue("imageSize", "", { shouldDirty: true });
                if (updateNodeData && selectedNodeId) {
                    updateNodeData(selectedNodeId, { imageSize: "" });
                }
            }
            return;
        }

        const availableValues = new Set(sizeOptions.map((o) => o.value));
        const defaultSize = sizeOptions[0]?.value || IMAGEGEN_CONFIG.DEFAULT_IMAGE_SIZE;

        if (!currentSize) {
            form.setValue("imageSize", defaultSize, { shouldDirty: true });
            if (updateNodeData && selectedNodeId) {
                updateNodeData(selectedNodeId, { imageSize: defaultSize });
            }
            return;
        }

        if (!availableValues.has(currentSize)) {
            const currentRatioName = IMAGEGEN_SIZE_NAMES[currentSize] || null;

            const sameRatioCandidate = currentRatioName
                ? (sizeOptions.find((o) => IMAGEGEN_SIZE_NAMES[o.value] === currentRatioName)?.value || null)
                : null;

            const aspectCandidate = (() => {
                const currentAspect = getSizeAspectValue(currentSize);
                if (currentAspect == null) return null;
                let best: { value: string; diff: number } | null = null;
                for (const opt of sizeOptions) {
                    const optAspect = getSizeAspectValue(opt.value);
                    if (optAspect == null) continue;
                    const diff = Math.abs(optAspect - currentAspect);
                    if (!best || diff < best.diff) best = { value: opt.value, diff };
                }
                return best?.value || null;
            })();

            const nextSize = sameRatioCandidate || aspectCandidate || defaultSize;
            form.setValue("imageSize", nextSize, { shouldDirty: true });
            if (updateNodeData && selectedNodeId) {
                updateNodeData(selectedNodeId, { imageSize: nextSize });
            }
        }
    }, [form, modelCapabilities.supportsImageSize, selectedNodeId, sizeOptions, updateNodeData]);

    const currentQuality = useMemo(() => {
        return hookCalculateQuality(currentSteps);
    }, [currentSteps, hookCalculateQuality]);

    const lastQualityRef = useRef<number>(50);

    const handleQualityChange = (newQuality: number) => {
        lastQualityRef.current = newQuality;
        const newSteps = hookCalculateSteps(newQuality);
        form.setValue("numInferenceSteps", newSteps, { shouldDirty: true });
        if (updateNodeData && selectedNodeId) {
            updateNodeData(selectedNodeId, { numInferenceSteps: newSteps });
        }
    };

    useEffect(() => {
        const safeSteps = hookCalculateSteps(lastQualityRef.current);
        if (currentSteps < stepRange.min || currentSteps > stepRange.max) {
            form.setValue("numInferenceSteps", safeSteps);
            if (updateNodeData && selectedNodeId) {
                updateNodeData(selectedNodeId, { numInferenceSteps: safeSteps });
            }
        }
    }, [currentSteps, stepRange.min, stepRange.max, form, selectedNodeId, updateNodeData, hookCalculateSteps]);

    const currentCfgValue = useWatch({
        control: form.control,
        name: "cfg",
        defaultValue: modelCapabilities.defaultCfg ?? 7.5,
    });

    useEffect(() => {
        if (currentCfgValue < cfgRange.min || currentCfgValue > cfgRange.max) {
            const safeCfg = modelCapabilities.defaultCfg ?? 7.5;
            form.setValue("cfg", safeCfg);
            if (updateNodeData && selectedNodeId) {
                updateNodeData(selectedNodeId, { cfg: safeCfg });
            }
        }
    }, [currentCfgValue, cfgRange.min, cfgRange.max, modelCapabilities.defaultCfg, form, selectedNodeId, updateNodeData]);

    const currentCfgQuality = useMemo(() => {
        return hookCalculateCfgQuality(currentCfgValue);
    }, [currentCfgValue, hookCalculateCfgQuality]);

    const handleCfgQualityChange = (newQuality: number) => {
        const newValue = hookCalculateCfgValue(newQuality);
        form.setValue("cfg", newValue, { shouldDirty: true });
        if (updateNodeData && selectedNodeId) {
            updateNodeData(selectedNodeId, { cfg: newValue });
        }
    };

    const currentRefImg1 = form.watch("referenceImageUrl") || "";
    const currentRefImg2 = form.watch("referenceImageUrl2") || "";
    const currentRefImg3 = form.watch("referenceImageUrl3") || "";

    const getSlotConfig = (slotIndex: 1 | 2 | 3) => {
        if (slotIndex === 1) return {
            urlField: "referenceImageUrl" as const,
            ref: fileInputRef1,
            currentUrl: currentRefImg1
        };
        if (slotIndex === 2) return {
            urlField: "referenceImageUrl2" as const,
            ref: fileInputRef2,
            currentUrl: currentRefImg2
        };
        return {
            urlField: "referenceImageUrl3" as const,
            ref: fileInputRef3,
            currentUrl: currentRefImg3
        };
    };

    const handleReferenceImageUpload = async (files: FileList | null, slotIndex: 1 | 2 | 3) => {
        if (!files || files.length === 0 || !selectedNodeId || !currentFlowId) return;

        const file = files[0];
        const { urlField } = getSlotConfig(slotIndex);
        const slotKey = String(slotIndex);

        if (!file.type.startsWith("image/")) {
            showError("文件类型错误", "请上传图片文件（PNG、JPG、JPEG、WEBP）");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showError("文件过大", "图片大小不能超过 10MB");
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setLocalPreviews(prev => ({ ...prev, [slotKey]: previewUrl }));
        setIsUploading(prev => ({ ...prev, [slotKey]: true }));

        try {
            const result = await fileUploadService.completeUpload(file, selectedNodeId, currentFlowId);

            if (result) {
                form.setValue(urlField, result.url);
                updateNodeData(selectedNodeId, { [urlField]: result.url });
                setLocalPreviews(prev => {
                    const next = { ...prev };
                    delete next[slotKey];
                    return next;
                });
            } else {
                throw new Error("上传失败");
            }
        } catch (error) {
            showError("上传失败", error instanceof Error ? error.message : "未知错误");
            setLocalPreviews(prev => {
                const next = { ...prev };
                delete next[slotKey];
                return next;
            });
        } finally {
            setIsUploading(prev => ({ ...prev, [slotKey]: false }));
            URL.revokeObjectURL(previewUrl);
        }
    };

    const handleDeleteReferenceImage = (slotIndex: 1 | 2 | 3) => {
        if (!selectedNodeId) return;
        const { urlField } = getSlotConfig(slotIndex);
        const slotKey = String(slotIndex);

        form.setValue(urlField, "");
        updateNodeData(selectedNodeId, { [urlField]: "" });

        const preview = localPreviews[slotKey];
        if (preview) {
            URL.revokeObjectURL(preview);
        }

        setLocalPreviews(prev => {
            const next = { ...prev };
            delete next[slotKey];
            return next;
        });
    };

    return (
        <div className="space-y-4 px-1 pb-4">
            {/* 1. 基础信息与模型 - 紧凑布局 */}
            <div className="grid gap-4">
                    <FormField
                        control={form.control}
                        name="label"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={STYLES.LABEL}>节点名称</FormLabel>
                                <FormControl>
                                    <Input {...field} className={STYLES.INPUT} placeholder="图像生成" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={STYLES.LABEL}>生成模型</FormLabel>
                                {modelsError ? (
                                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                                        <span className="text-xs text-red-500">{modelsError}</span>
                                        <button
                                            type="button"
                                            onClick={loadModels}
                                            className="text-xs text-blue-600 hover:underline font-medium"
                                        >
                                            重试
                                        </button>
                                    </div>
                                ) : (
                                    <Select
                                        key={field.value}
                                        onValueChange={field.onChange}
                                        value={field.value || "Kwai-Kolors/Kolors"}
                                    >
                                        <FormControl>
                                            <SelectTrigger className={STYLES.INPUT} disabled={modelsLoading}>
                                                <SelectValue placeholder={modelsLoading ? "正在加载模型…" : "选择一个模型"}>
                                                    {field.value ? getModelDisplayName(field.value) : "选择模型"}
                                                </SelectValue>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {models.map(model => (
                                                <SelectItem key={model.id} value={model.model_id} className="cursor-pointer text-xs">
                                                    {model.model_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
            </div>

            <div className={STYLES.SECTION_DIVIDER} />

            {/* 2. 核心 Prompt - 编辑器风格 */}
            <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                    <FormItem>
                        <div className={STYLES.EDITOR_WRAPPER}>
                            <div className={STYLES.EDITOR_HEADER}>
                                <div className={STYLES.EDITOR_LABEL}>
                                    <Palette className="w-3.5 h-3.5" />
                                    生成描述
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium cursor-help hover:bg-indigo-100 transition-colors border border-indigo-100">
                                                <span className="font-mono text-xs opacity-70">{"{{ }}"}</span>
                                                <span>引用变量</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="text-xs max-w-[220px] p-3 shadow-lg">
                                            <p className="font-semibold mb-1">如何引用上游变量？</p>
                                            <p className="text-gray-500 leading-relaxed">
                                                输入 <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{"{{节点名.变量}}"}</span> 即可引用上游节点的输出内容。
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder="描述你想生成的画面，支持 {{变量}} 引用…"
                                    className={STYLES.EDITOR_AREA}
                                    spellCheck={false}
                                />
                            </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* 3. 生成选项 (Capabilities List) */}
            <div className="space-y-2">
                <div className={STYLES.SECTION_TITLE}>图像生成设置</div>
                
                <div className={`${STYLES.CARD} p-0 overflow-hidden divide-y divide-gray-100`}>
                    
                    {/* Item 1: Negative Prompt */}
                    {modelCapabilities.supportsNegativePrompt && (
                        <FormField
                            control={form.control}
                            name="negativePrompt"
                            render={({ field }) => (
                                <CapabilityItem
                                    icon={<MessageSquareX className="w-4 h-4" />}
                                    iconColorClass="bg-red-50 text-red-600"
                                    title="排除元素"
                                    description="指定画面中不希望出现的元素"
                                    isExpanded={showNegativePrompt}
                                    rightElement={
                                        <Switch
                                            checked={showNegativePrompt}
                                            onCheckedChange={(checked) => {
                                                setShowNegativePrompt(checked);
                                                if (!checked) {
                                                    // Optional: Clear value or just hide? 
                                                }
                                            }}
                                        />
                                    }
                                >
                                    <div className="pt-2 pb-1 pr-4">
                                        <Textarea
                                            {...field}
                                            placeholder="例如：模糊、低质量、变形…"
                                            className={STYLES.TEXTAREA}
                                        />
                                    </div>
                                </CapabilityItem>
                            )}
                        />
                    )}

                    {/* Item 2: Image Size */}
                    {modelCapabilities.supportsImageSize && sizeOptions.length > 0 && (
                        <FormField
                            control={form.control}
                            name="imageSize"
                            render={({ field }) => {
                                const defaultSize = sizeOptions[0]?.value || "1024x1024";
                                return (
                                    <CapabilityItem
                                        icon={<Scaling className="w-4 h-4" />}
                                        iconColorClass="bg-blue-50 text-blue-600"
                                        title="画幅比例与尺寸"
                                        description="选择生成比例与分辨率"
                                        isExpanded={false} // No expansion needed, direct control
                                        rightElement={
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value || defaultSize}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-gray-200">
                                                        <SelectValue placeholder="选择尺寸" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {sizeOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value} className="text-xs">
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        }
                                    />
                                );
                            }}
                        />
                    )}

                    {/* Item 3: Reference Image */}
                    {modelCapabilities.supportsReferenceImage && (
                        <CapabilityItem
                            icon={<ImagePlus className="w-4 h-4" />}
                            iconColorClass="bg-orange-50 text-orange-600"
                            title="参考图"
                            description="上传或引用图片作为 AI 生成的参考"
                            isExpanded={true}
                            rightElement={
                                <div className="flex items-center gap-3">
                                    {Object.values(isUploading).some(Boolean) && (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                                    )}
                                    <Switch
                                        checked={true}
                                        disabled={true}
                                        onCheckedChange={() => {}}
                                    />
                                </div>
                            }
                        >
                            <div className="pt-2 pb-1 pr-4 space-y-4">
                                {/* 模式切换 */}
                                <div className="flex p-1 bg-gray-100/80 rounded-lg gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            form.setValue("referenceImageMode", "variable");
                                            if (updateNodeData && selectedNodeId) {
                                                updateNodeData(selectedNodeId, { referenceImageMode: "variable" });
                                            }
                                        }}
                                        className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${form.watch("referenceImageMode") === "variable"
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                            }`}
                                    >
                                        引用变量
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            form.setValue("referenceImageMode", "static");
                                            if (updateNodeData && selectedNodeId) {
                                                updateNodeData(selectedNodeId, { referenceImageMode: "static" });
                                            }
                                        }}
                                        className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${form.watch("referenceImageMode") !== "variable"
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                            }`}
                                    >
                                        上传图片
                                    </button>
                                </div>

                                {/* 变量引用模式 */}
                                {form.watch("referenceImageMode") === "variable" ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">主图</span>
                                            <div className="relative flex-1">
                                                <FormField
                                                    control={form.control}
                                                    name="referenceImageVariable"
                                                    render={({ field }) => (
                                                        <input
                                                            {...field}
                                                            value={field.value || ""}
                                                            placeholder="{{节点名.imageUrl}}"
                                                            className={STYLES.VARIABLE_INPUT}
                                                        />
                                                    )}
                                                />
                                                {form.watch("referenceImageVariable") && (
                                                    <button
                                                        type="button"
                                                        onClick={() => form.setValue("referenceImageVariable", "")}
                                                        className={`absolute right-1 top-1/2 -translate-y-1/2 ${STYLES.REMOVE_BUTTON}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {(form.watch("referenceImage2Variable") || showExtraImages >= 1) && (
                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">副图</span>
                                                <div className="relative flex-1">
                                                    <FormField
                                                        control={form.control}
                                                        name="referenceImage2Variable"
                                                        render={({ field }) => (
                                                            <input
                                                                {...field}
                                                                value={field.value || ""}
                                                        placeholder="{{节点名.imageUrl}}"
                                                                className={STYLES.VARIABLE_INPUT}
                                                            />
                                                        )}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            form.setValue("referenceImage2Variable", "");
                                                            setShowExtraImages(prev => Math.max(0, prev - 1));
                                                        }}
                                                        className={`absolute right-1 top-1/2 -translate-y-1/2 ${STYLES.REMOVE_BUTTON}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {(modelCapabilities.maxReferenceImages ?? 1) > 1 && (() => {
                                            const hasImage2 = form.watch("referenceImage2Variable") || showExtraImages >= 1;
                                            const maxImages = modelCapabilities.maxReferenceImages ?? 1;
                                            const canAddMore = (!hasImage2 && maxImages >= 2);

                                            return canAddMore ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowExtraImages(prev => Math.min(2, prev + 1))}
                                                    className={STYLES.ADD_BUTTON}
                                                >
                                                    <span>+</span>
                                                    添加参考图
                                                </button>
                                            ) : null;
                                        })()}
                                    </div>
                                ) : (
                                    /* 静态上传模式 */
                                    <div className="space-y-3">
                                        <ImageSlotUploader
                                            slotIndex={1}
                                            slotType="main"
                                            currentUrl={currentRefImg1}
                                            localPreview={localPreviews['1']}
                                            isUploading={isUploading['1'] || false}
                                            onUpload={(files) => handleReferenceImageUpload(files, 1)}
                                            onDelete={() => handleDeleteReferenceImage(1)}
                                            inputId="ref-img-1"
                                        />

                                        {(currentRefImg2 || showExtraImages >= 1) && (
                                            <ImageSlotUploader
                                                slotIndex={2}
                                                slotType="sub"
                                                currentUrl={currentRefImg2}
                                                localPreview={localPreviews['2']}
                                                isUploading={isUploading['2'] || false}
                                                onUpload={(files) => handleReferenceImageUpload(files, 2)}
                                                onDelete={() => handleDeleteReferenceImage(2)}
                                                onRemoveSlot={() => {
                                                    handleDeleteReferenceImage(2);
                                                    setShowExtraImages(prev => Math.max(0, prev - 1));
                                                }}
                                                inputId="ref-img-2"
                                            />
                                        )}

                                        {(modelCapabilities.maxReferenceImages ?? 1) > 1 && (() => {
                                            const hasImage2 = currentRefImg2 || showExtraImages >= 1;
                                            const maxImages = modelCapabilities.maxReferenceImages ?? 1;
                                            const canAddMore = (!hasImage2 && maxImages >= 2);

                                            return canAddMore ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowExtraImages(prev => Math.min(2, prev + 1))}
                                                    className={STYLES.ADD_BUTTON}
                                                >
                                                    <span>+</span>
                                                    添加参考图
                                                </button>
                                            ) : null;
                                        })()}
                                    </div>
                                )}
                            </div>
                        </CapabilityItem>
                    )}

                    {/* Item 4: Advanced Params */}
                    {(modelCapabilities.cfgParam || modelCapabilities.supportsInferenceSteps) && (
                        <CapabilityItem
                            icon={<SlidersHorizontal className="w-4 h-4" />}
                            iconColorClass="bg-purple-50 text-purple-600"
                            title="高级参数"
                            description="调整生成质量与创意系数"
                            isExpanded={showAdvanced}
                            rightElement={
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="p-1 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"
                                >
                                    {showAdvanced ? (
                                        <ChevronUp className="w-4 h-4" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            }
                        >
                            <div className="pt-2 pb-1 pr-4 space-y-6">
                                {modelCapabilities.cfgParam && (
                                    <FormField
                                        control={form.control}
                                        name="cfg"
                                        render={() => (
                                            <FormItem>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={STYLES.SLIDER_LABEL}>创意系数 (CFG)</span>
                                                    <span className={STYLES.SLIDER_VALUE}>{currentCfgQuality}%</span>
                                                </div>
                                                <FormControl>
                                                    <Slider
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        value={[currentCfgQuality]}
                                                        onValueChange={(vals) => handleCfgQualityChange(vals[0])}
                                                        className="py-1"
                                                    />
                                                </FormControl>
                                                <div className={STYLES.SLIDER_RANGE}>
                                                    <span>忠实提示词</span>
                                                    <span>自由发挥</span>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {modelCapabilities.supportsInferenceSteps && (
                                    <FormField
                                        control={form.control}
                                        name="numInferenceSteps"
                                        render={() => (
                                            <FormItem>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={STYLES.SLIDER_LABEL}>生成质量 (Steps)</span>
                                                    <span className={STYLES.SLIDER_VALUE}>{currentQuality}%</span>
                                                </div>
                                                <FormControl>
                                                    <Slider
                                                        min={IMAGEGEN_CONFIG.QUALITY_MIN}
                                                        max={IMAGEGEN_CONFIG.QUALITY_MAX}
                                                        step={1}
                                                        value={[currentQuality]}
                                                        onValueChange={(vals) => handleQualityChange(vals[0])}
                                                        className="py-1"
                                                    />
                                                </FormControl>
                                                <div className={STYLES.SLIDER_RANGE}>
                                                    <span>极速</span>
                                                    <span>精细</span>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </CapabilityItem>
                    )}
                </div>
            </div>
        </div>
    );
}
