"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { fileUploadService } from "@/services/fileUploadService";
import { useFlowStore } from "@/store/flowStore";
import { showError } from "@/utils/errorNotify";
import { NODE_FORM_STYLES, type ExtendedNodeFormProps } from "./shared";
import type { AppNode, ImageGenNodeData } from "@/types/flow";
import { useImageGenModel } from "@/hooks/useImageGenModel";
import { IMAGEGEN_CONFIG } from "@/store/constants/imageGenConstants";
import { ImageSlotUploader } from "./components/ImageSlotUploader";

const { LABEL: LABEL_CLASS, INPUT: INPUT_CLASS, SLIDER_LABEL, SLIDER_VALUE } = NODE_FORM_STYLES;

/**
 * ImageGen 节点配置表单 Props
 */
interface ImageGenNodeFormProps extends ExtendedNodeFormProps {
    selectedNode?: AppNode;
}

/**
 * ImageGen 节点配置表单
 * 模型列表从数据库动态加载
 * 根据模型能力动态显示/隐藏字段（负向提示词、引导系数等）
 */
export function ImageGenNodeForm({ form, selectedNodeId, updateNodeData, selectedNode }: ImageGenNodeFormProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Reference image upload state
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
    const fileInputRef1 = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);
    const fileInputRef3 = useRef<HTMLInputElement>(null);
    const [showExtraImages, setShowExtraImages] = useState<number>(0);

    // Get flow ID for file upload
    const currentFlowId = useFlowStore((s) => s.currentFlowId);

    // 监听选中的模型，动态获取能力
    const selectedModelId = useWatch({
        control: form.control,
        name: "model",
        defaultValue: "",
    });

    // 使用 Hook 统一管理模型加载和能力查询
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

    // ============ 推理步数 <-> 生成质量 转换逻辑 ============
    // 使用 Hook 提供的 stepRange 和转换函数
    const getStepRange = stepRange;

    // 当前步数 (form value)
    const currentSteps = useWatch({
        control: form.control,
        name: "numInferenceSteps",
        defaultValue: modelCapabilities.defaultSteps ?? 25,
    });

    // 计算当前显示的质量百分比
    const currentQuality = useMemo(() => {
        return hookCalculateQuality(currentSteps);
    }, [currentSteps, hookCalculateQuality]);

    // 监听模型/范围变化，维持质量百分比不变，自动调整步数
    // 使用 ref 避免死循环，记录上一次的 quality
    const lastQualityRef = useRef<number>(50); // Default middle quality

    // 当用户手动拖动滑块时更新 ref
    const handleQualityChange = (newQuality: number) => {
        lastQualityRef.current = newQuality;
        const newSteps = hookCalculateSteps(newQuality);
        form.setValue("numInferenceSteps", newSteps, { shouldDirty: true });
        if (updateNodeData && selectedNodeId) {
            updateNodeData(selectedNodeId, { numInferenceSteps: newSteps });
        }
    };

    // 当模型切换（导致范围变化）时，尝试保持之前的质量
    useEffect(() => {
        // 如果当前步数超出了新范围
        const safeSteps = hookCalculateSteps(lastQualityRef.current);

        if (currentSteps < stepRange.min || currentSteps > stepRange.max) {
            form.setValue("numInferenceSteps", safeSteps);
            if (updateNodeData && selectedNodeId) {
                updateNodeData(selectedNodeId, { numInferenceSteps: safeSteps });
            }
        }
    }, [stepRange.min, stepRange.max, form, selectedNodeId, updateNodeData, hookCalculateSteps]); // Remove currentSteps dep

    // ============ 创意系数 (CFG) <-> 0-100% 转换逻辑 ============
    // 使用 Hook 提供的 cfgRange 和转换函数
    const getCfgRange = cfgRange;

    // 当前 CFG 值 (form value)
    const currentCfgValue = useWatch({
        control: form.control,
        name: "cfg",
        defaultValue: modelCapabilities.defaultCfg ?? 7.5,
    });

    // 监听模型/范围变化，维持 CFG 在有效范围内
    useEffect(() => {
        if (currentCfgValue < cfgRange.min || currentCfgValue > cfgRange.max) {
            // 如果当前值超出范围，重置为默认值
            const safeCfg = modelCapabilities.defaultCfg ?? 7.5;
            form.setValue("cfg", safeCfg);
            if (updateNodeData && selectedNodeId) {
                updateNodeData(selectedNodeId, { cfg: safeCfg });
            }
        }
    }, [cfgRange.min, cfgRange.max, modelCapabilities.defaultCfg, form, selectedNodeId, updateNodeData]);

    // 计算当前显示的 CFG 百分比
    const currentCfgQuality = useMemo(() => {
        return hookCalculateCfgQuality(currentCfgValue);
    }, [currentCfgValue, hookCalculateCfgQuality]);

    // 处理 CFG 滑块变化
    const handleCfgQualityChange = (newQuality: number) => {
        const newValue = hookCalculateCfgValue(newQuality);
        form.setValue("cfg", newValue, { shouldDirty: true });
        if (updateNodeData && selectedNodeId) {
            updateNodeData(selectedNodeId, { cfg: newValue });
        }
    };

    // Get current reference URLs - unified to use form.watch() as single source
    // Form is initialized from selectedNode, so form.watch is always the source of truth
    const currentRefImg1 = form.watch("referenceImageUrl") || "";
    const currentRefImg2 = form.watch("referenceImageUrl2") || "";
    const currentRefImg3 = form.watch("referenceImageUrl3") || "";

    // Helper to get slot config
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

    // Handle upload for a specific slot
    const handleReferenceImageUpload = async (files: FileList | null, slotIndex: 1 | 2 | 3) => {
        if (!files || files.length === 0 || !selectedNodeId || !currentFlowId) return;

        const file = files[0];
        const { urlField } = getSlotConfig(slotIndex);
        const slotKey = String(slotIndex);

        if (!file.type.startsWith("image/")) {
            showError("文件类型错误", "请上传图片文件 (PNG, JPG, JPEG, WEBP)");
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
                    delete next[slotKey]; // Clear local preview on success
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

    // Delete image from slot
    const handleDeleteReferenceImage = (slotIndex: 1 | 2 | 3) => {
        if (!selectedNodeId) return;
        const { urlField } = getSlotConfig(slotIndex);
        const slotKey = String(slotIndex);

        form.setValue(urlField, "");
        updateNodeData(selectedNodeId, { [urlField]: "" });

        // Revoke ObjectURL to prevent memory leak
        const preview = localPreviews[slotKey];
        if (preview) {
            URL.revokeObjectURL(preview);
        }

        setLocalPreviews(prev => {
            const next = { ...prev };
            delete next[slotKey];
            return next;
        });

        // If deleting a secondary slot, we might want to collapse it if it was the last one
        // But the design says "click [x] next to slot title removes slot", this is "delete image inside slot"
        // so we keep the slot open, just empty.
    };

    return (
        <div className="space-y-4">
            {/* 节点名称 */}
            <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={LABEL_CLASS}>节点名称</FormLabel>
                        <FormControl>
                            <Input {...field} className={`font-medium ${INPUT_CLASS}`} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* 模型选择 */}
            <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={LABEL_CLASS}>生成模型</FormLabel>
                        {modelsError ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-red-500">{modelsError}</span>
                                <button
                                    type="button"
                                    onClick={loadModels}
                                    className="text-xs text-blue-600 hover:underline"
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
                                    <SelectTrigger className={INPUT_CLASS} disabled={modelsLoading}>
                                        <SelectValue placeholder={modelsLoading ? "加载中..." : "选择模型"}>
                                            {field.value ? getModelDisplayName(field.value) : "选择模型"}
                                        </SelectValue>
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {models.map(model => (
                                        <SelectItem key={model.id} value={model.model_id} className="cursor-pointer">
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

            {/* 图片描述 */}
            <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={LABEL_CLASS}>
                            图片描述
                            <span className="text-red-500 ml-1 text-[10px]">*</span>
                            <span className="ml-2 text-[9px] font-normal text-gray-400 normal-case">
                                支持通过{`{{变量名}}`}引用变量的值
                            </span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="描述你想生成的图片，例如：一只可爱的橘猫坐在窗台上看夕阳"
                                className={`min-h-[100px] ${INPUT_CLASS} font-mono bg-white`}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* 负向提示词 - 仅支持的模型显示 */}
            {modelCapabilities.supportsNegativePrompt && (
                <FormField
                    control={form.control}
                    name="negativePrompt"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={LABEL_CLASS}>
                                负向提示词
                                <span className="ml-2 text-[9px] font-normal text-gray-400 normal-case">
                                    排除不想要的元素
                                </span>
                            </FormLabel>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder="例如：白色、手指、低质量、模糊（请勿填写“不要”）"
                                    className={`min-h-[80px] ${INPUT_CLASS} font-mono bg-white`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {/* 图片比例 - 仅支持的模型显示 */}
            {modelCapabilities.supportsImageSize && sizeOptions.length > 0 && (
                <FormField
                    control={form.control}
                    name="imageSize"
                    render={({ field }) => {
                        const defaultSize = sizeOptions[0]?.value || "1024x1024";
                        return (
                            <FormItem>
                                <FormLabel className={LABEL_CLASS}>图片比例</FormLabel>
                                <Select
                                    key={field.value}
                                    onValueChange={field.onChange}
                                    value={field.value || defaultSize}
                                >
                                    <FormControl>
                                        <SelectTrigger className={INPUT_CLASS}>
                                            <SelectValue placeholder="选择比例" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {sizeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            )}

            {/* 分隔线 - 仅当有高级参数时显示 */}
            {(modelCapabilities.cfgParam || modelCapabilities.supportsInferenceSteps) && (
                <>
                    <div className={NODE_FORM_STYLES.SECTION_DIVIDER} />

                    {/* 高级参数标题 - 可折叠 */}
                    <div className="space-y-2">
                        <div
                            className="flex items-center justify-between cursor-pointer group py-2"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            <div className={`${LABEL_CLASS} px-1 group-hover:text-gray-900 transition-colors`}>高级设置</div>
                            {showAdvanced ? (
                                <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                            ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                            )}
                        </div>

                        {showAdvanced && (
                            <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                {/* 引导系数 (CFG) - 仅支持的模型显示 */}
                                {modelCapabilities.cfgParam && (
                                    <FormField
                                        control={form.control}
                                        name="cfg"
                                        render={({ field }) => {
                                            return (
                                                <FormItem>
                                                    <div className="flex items-center justify-between">
                                                        <span className={SLIDER_LABEL}>创意系数</span>
                                                        <span className={SLIDER_VALUE}>
                                                            {currentCfgQuality}%
                                                        </span>
                                                    </div>
                                                    <FormControl>
                                                        <Slider
                                                            min={0}
                                                            max={100}
                                                            step={1}
                                                            value={[currentCfgQuality]}
                                                            onValueChange={(vals) => handleCfgQualityChange(vals[0])}
                                                            className="py-2"
                                                        />
                                                    </FormControl>
                                                    <p className="text-[9px] text-gray-400">
                                                        越高越有创意，越低越接近提示词
                                                    </p>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                )}

                                {/* 推理步数 - 仅支持的模型显示 */}
                                {modelCapabilities.supportsInferenceSteps && (
                                    <FormField
                                        control={form.control}
                                        name="numInferenceSteps"
                                        render={({ field }) => {
                                            // 这里的 field.value 是实际步数，但我们渲染的是基于 Quality 的 Slider
                                            return (
                                                <FormItem>
                                                    <div className="flex items-center justify-between">
                                                        <span className={SLIDER_LABEL}>生成质量</span>
                                                        <span className={SLIDER_VALUE}>
                                                            {currentQuality}%
                                                        </span>
                                                    </div>
                                                    <FormControl>
                                                        <Slider
                                                            min={IMAGEGEN_CONFIG.QUALITY_MIN}
                                                            max={IMAGEGEN_CONFIG.QUALITY_MAX}
                                                            step={1}
                                                            value={[currentQuality]}
                                                            onValueChange={(vals) => handleQualityChange(vals[0])}
                                                            className="py-2"
                                                        />
                                                    </FormControl>
                                                    <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1">
                                                        <span>极速</span>
                                                        <span>最佳</span>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 参考图配置 - 仅图生图模型显示 */}
            {modelCapabilities.supportsReferenceImage && (
                <>
                    <div className="border-t border-gray-100 my-2" />
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className={LABEL_CLASS}>
                                参考图
                            </div>
                            {Object.values(isUploading).some(Boolean) && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                        </div>

                        {/* 模式切换 - Segmented Control */}
                        <div className="flex p-1 bg-gray-100 rounded-lg gap-1">
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
                                变量引用
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
                                静态上传
                            </button>
                        </div>

                        {/* 变量引用模式 */}
                        {form.watch("referenceImageMode") === "variable" ? (
                            <div className="space-y-2">
                                {/* 主图 - 必填 */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[10px] text-blue-600 font-medium">1.</span>
                                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">主图</span>
                                    </div>
                                    <div className="relative flex-1">
                                        <FormField
                                            control={form.control}
                                            name="referenceImageVariable"
                                            render={({ field }) => (
                                                <input
                                                    {...field}
                                                    value={field.value || ""}
                                                    placeholder="图片URL变量"
                                                    className="w-full text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono bg-white pr-7"
                                                />
                                            )}
                                        />
                                        {form.watch("referenceImageVariable") && (
                                            <button
                                                type="button"
                                                onClick={() => form.setValue("referenceImageVariable", "")}
                                                className={`absolute right-1 top-1/2 -translate-y-1/2 ${NODE_FORM_STYLES.REMOVE_BUTTON}`}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 副图2 - 动态显示 */}
                                {(form.watch("referenceImage2Variable") || showExtraImages >= 1) && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-gray-500 font-medium">2.</span>
                                            <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">副图</span>
                                        </div>
                                        <div className="relative flex-1">
                                            <FormField
                                                control={form.control}
                                                name="referenceImage2Variable"
                                                render={({ field }) => (
                                                    <input
                                                        {...field}
                                                        value={field.value || ""}
                                                        placeholder="图片URL变量"
                                                        className="w-full text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono bg-white pr-7"
                                                    />
                                                )}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    form.setValue("referenceImage2Variable", "");
                                                    setShowExtraImages(prev => Math.max(0, prev - 1));
                                                }}
                                                className={`absolute right-1 top-1/2 -translate-y-1/2 ${NODE_FORM_STYLES.REMOVE_BUTTON}`}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 副图3 - 动态显示 */}
                                {(form.watch("referenceImage3Variable") || showExtraImages >= 2) && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-gray-500 font-medium">3.</span>
                                            <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">副图</span>
                                        </div>
                                        <div className="relative flex-1">
                                            <FormField
                                                control={form.control}
                                                name="referenceImage3Variable"
                                                render={({ field }) => (
                                                    <input
                                                        {...field}
                                                        value={field.value || ""}
                                                        placeholder="图片URL变量"
                                                        className="w-full text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono bg-white pr-7"
                                                    />
                                                )}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    form.setValue("referenceImage3Variable", "");
                                                    setShowExtraImages(prev => Math.max(0, prev - 1));
                                                }}
                                                className={`absolute right-1 top-1/2 -translate-y-1/2 ${NODE_FORM_STYLES.REMOVE_BUTTON}`}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 添加参考图按钮 - 仅支持多图的模型显示 */}
                                {(modelCapabilities.maxReferenceImages ?? 1) > 1 && (() => {
                                    const hasImage2 = form.watch("referenceImage2Variable") || showExtraImages >= 1;
                                    const hasImage3 = form.watch("referenceImage3Variable") || showExtraImages >= 2;
                                    const maxImages = modelCapabilities.maxReferenceImages ?? 1;
                                    const canAddMore = (!hasImage2 && maxImages >= 2) || (!hasImage3 && maxImages >= 3 && hasImage2);

                                    return canAddMore ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowExtraImages(prev => Math.min(2, prev + 1))}
                                            className={NODE_FORM_STYLES.ADD_BUTTON}
                                        >
                                            <span>+</span>
                                            添加参考图
                                        </button>
                                    ) : null;
                                })()}

                                <p className="text-[9px] text-gray-400 pt-1">
                                    💡 融合多张图片生成新图，主图权重最高
                                </p>
                            </div>
                        ) : (
                            /* 静态上传模式 */
                            /* 静态上传模式 */
                            <div className="space-y-3">
                                {/* Slot 1: Main Image - Using Component */}
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

                                {/* Slot 2: Sub Image - Using Component */}
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

                                {/* Slot 3: Sub Image - Using Component */}
                                {(currentRefImg3 || showExtraImages >= 2) && (
                                    <ImageSlotUploader
                                        slotIndex={3}
                                        slotType="sub"
                                        currentUrl={currentRefImg3}
                                        localPreview={localPreviews['3']}
                                        isUploading={isUploading['3'] || false}
                                        onUpload={(files) => handleReferenceImageUpload(files, 3)}
                                        onDelete={() => handleDeleteReferenceImage(3)}
                                        onRemoveSlot={() => {
                                            handleDeleteReferenceImage(3);
                                            setShowExtraImages(prev => Math.max(0, prev - 1));
                                        }}
                                        inputId="ref-img-3"
                                    />
                                )}

                                {/* Add Button */}
                                {(modelCapabilities.maxReferenceImages ?? 1) > 1 && (() => {
                                    const hasImage2 = currentRefImg2 || showExtraImages >= 1;
                                    const hasImage3 = currentRefImg3 || showExtraImages >= 2;
                                    const maxImages = modelCapabilities.maxReferenceImages ?? 1;
                                    const canAddMore = (!hasImage2 && maxImages >= 2) || (!hasImage3 && maxImages >= 3 && hasImage2);

                                    return canAddMore ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowExtraImages(prev => Math.min(2, prev + 1))}
                                            className={NODE_FORM_STYLES.ADD_BUTTON}
                                        >
                                            <span>+</span>
                                            添加参考图
                                        </button>
                                    ) : null;
                                })()}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
