"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronUp, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { imageGenModelsAPI, type ImageGenModel, DEFAULT_IMAGEGEN_CAPABILITIES } from "@/services/imageGenModelsAPI";
import { fileUploadService } from "@/services/fileUploadService";
import { useFlowStore } from "@/store/flowStore";
import { showError } from "@/utils/errorNotify";
import { NODE_FORM_STYLES, type ExtendedNodeFormProps } from "./shared";
import type { AppNode, ImageGenNodeData } from "@/types/flow";

const { LABEL: LABEL_CLASS, INPUT: INPUT_CLASS } = NODE_FORM_STYLES;

// ============ 配置常量 ============
const IMAGEGEN_CONFIG = {
    // 推理步数配置
    // 推理步数配置 (Fallback defaults)
    STEPS_MIN_DEFAULT: 1,
    STEPS_MAX_DEFAULT: 50,
    // Quality slider range
    QUALITY_MIN: 1,
    QUALITY_MAX: 100,
    // CFG 滑块步进
    CFG_STEP: 0.1,
} as const;

// 尺寸 ID 到中文名映射
const SIZE_DISPLAY_NAMES: Record<string, string> = {
    '1024x1024': '1:1 正方形',
    '960x1280': '3:4 竖版',
    '768x1024': '3:4 竖版',
    '720x1440': '1:2 竖版',
    '720x1280': '9:16 竖版',
    '1328x1328': '1:1 正方形',
    '1664x928': '16:9 横版',
    '928x1664': '9:16 竖版',
    '1472x1140': '4:3 横版',
    '1140x1472': '3:4 竖版',
    '1584x1056': '3:2 横版',
    '1056x1584': '2:3 竖版',
};

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
    const [models, setModels] = useState<ImageGenModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState<string | null>(null);
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

    // 加载可用模型列表
    const loadModels = async () => {
        setModelsLoading(true);
        setModelsError(null);
        try {
            const data = await imageGenModelsAPI.listModels();
            setModels(data);
            if (data.length === 0) {
                setModelsError("暂无可用模型");
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "加载模型列表失败";
            setModelsError(errorMsg);
            showError("模型加载失败", errorMsg);
        } finally {
            setModelsLoading(false);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    // 监听选中的模型，动态获取能力
    const selectedModelId = useWatch({
        control: form.control,
        name: "model",
        defaultValue: "",
    });

    // 从已加载的模型列表中查找能力配置
    const modelCapabilities = useMemo(() => {
        const found = models.find(m => m.model_id === selectedModelId);
        return found?.capabilities || DEFAULT_IMAGEGEN_CAPABILITIES;
    }, [selectedModelId, models]);

    // 获取模型显示名称
    const getModelDisplayName = (modelId: string): string => {
        const model = models.find(m => m.model_id === modelId);
        return model?.model_name || modelId.split('/').pop() || modelId;
    };

    // ============ 推理步数 <-> 生成质量 转换逻辑 ============

    // 获取当前模型的步数范围
    const getStepRange = useMemo(() => {
        return {
            min: modelCapabilities.minInferenceSteps ?? IMAGEGEN_CONFIG.STEPS_MIN_DEFAULT,
            max: modelCapabilities.maxInferenceSteps ?? IMAGEGEN_CONFIG.STEPS_MAX_DEFAULT,
        };
    }, [modelCapabilities]);

    // 计算生成质量 (0-100)
    // Formula: Quality = (Steps - Min) / (Max - Min) * 100
    const calculateQuality = (steps: number, range: { min: number, max: number }): number => {
        if (range.max === range.min) return 100;
        const quality = ((steps - range.min) / (range.max - range.min)) * 100;
        return Math.round(Math.max(IMAGEGEN_CONFIG.QUALITY_MIN, Math.min(IMAGEGEN_CONFIG.QUALITY_MAX, quality)));
    };

    // 根据质量计算步数
    // Formula: Steps = Min + (Quality / 100) * (Max - Min)
    const calculateSteps = (quality: number, range: { min: number, max: number }): number => {
        const steps = range.min + (quality / 100) * (range.max - range.min);
        return Math.round(Math.max(range.min, Math.min(range.max, steps)));
    };

    // 当前步数 (form value)
    const currentSteps = useWatch({
        control: form.control,
        name: "numInferenceSteps",
        defaultValue: modelCapabilities.defaultSteps ?? 25,
    });

    // 计算当前显示的质量百分比
    const currentQuality = useMemo(() => {
        return calculateQuality(currentSteps, getStepRange);
    }, [currentSteps, getStepRange]);

    // 监听模型/范围变化，维持质量百分比不变，自动调整步数
    // 使用 ref 避免死循环，记录上一次的 quality
    const lastQualityRef = useRef<number>(50); // Default middle quality

    // 当用户手动拖动滑块时更新 ref
    const handleQualityChange = (newQuality: number) => {
        lastQualityRef.current = newQuality;
        const newSteps = calculateSteps(newQuality, getStepRange);
        form.setValue("numInferenceSteps", newSteps, { shouldDirty: true });
        if (updateNodeData && selectedNodeId) {
            updateNodeData(selectedNodeId, { numInferenceSteps: newSteps });
        }
    };

    // 当模型切换（导致范围变化）时，尝试保持之前的质量
    useEffect(() => {
        // 如果当前步数超出了新范围
        const safeSteps = calculateSteps(lastQualityRef.current, getStepRange);

        if (currentSteps < getStepRange.min || currentSteps > getStepRange.max) {
            form.setValue("numInferenceSteps", safeSteps);
            if (updateNodeData && selectedNodeId) {
                updateNodeData(selectedNodeId, { numInferenceSteps: safeSteps });
            }
        }
    }, [getStepRange.min, getStepRange.max, form, selectedNodeId, updateNodeData]); // Remove currentSteps dep

    // ============ 创意系数 (CFG) <-> 0-100% 转换逻辑 ============

    // 获取当前模型的 CFG 范围
    const getCfgRange = useMemo(() => {
        return modelCapabilities.cfgRange || { min: 0, max: 20 };
    }, [modelCapabilities]);

    // 计算 CFG 质量百分比 (0-100)
    // 注意：用户认为百分比越大越有创意，而实际 CFG 值越小越有创意
    // 所以逻辑是反着的：100% 对应 min(最有力/有创意)，0% 对应 max(最稳/接近提示词)
    const calculateCfgQuality = (cfg: number, range: { min: number, max: number }): number => {
        if (range.max === range.min) return 100;
        const quality = ((range.max - cfg) / (range.max - range.min)) * 100;
        return Math.round(Math.max(0, Math.min(100, quality)));
    };

    // 根据质量百分比计算实际 CFG 值
    const calculateCfgValue = (quality: number, range: { min: number, max: number }): number => {
        const val = range.max - (quality / 100) * (range.max - range.min);
        // 保留一位小数并确保在范围内
        return Math.round(val * 10) / 10;
    };

    // 当前 CFG 值 (form value)
    const currentCfgValue = useWatch({
        control: form.control,
        name: "cfg",
        defaultValue: modelCapabilities.defaultCfg ?? 7.5,
    });

    // 计算当前显示的 CFG 百分比
    const currentCfgQuality = useMemo(() => {
        return calculateCfgQuality(currentCfgValue, getCfgRange);
    }, [currentCfgValue, getCfgRange]);

    // 处理 CFG 滑块变化
    const handleCfgQualityChange = (newQuality: number) => {
        const newValue = calculateCfgValue(newQuality, getCfgRange);
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

        form.setValue(urlField, "");
        updateNodeData(selectedNodeId, { [urlField]: "" });
        setLocalPreviews(prev => {
            const next = { ...prev };
            delete next[String(slotIndex)];
            return next;
        });

        // If deleting a secondary slot, we might want to collapse it if it was the last one
        // But the design says "click [x] next to slot title removes slot", this is "delete image inside slot"
        // so we keep the slot open, just empty.
    };

    return (
        <>
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
                                        <SelectItem key={model.id} value={model.model_id}>
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
                            <span className="ml-2 text-[9px] font-normal text-gray-400 normal-case">
                                支持引用：{`{{节点名.字段名}}`}
                            </span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="描述你想生成的图片，例如：一只可爱的橘猫坐在窗台上看夕阳"
                                className={`min-h-[80px] ${INPUT_CLASS} font-mono`}
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
                                    placeholder="例如：模糊、低质量、变形、水印"
                                    className={`min-h-[60px] ${INPUT_CLASS} font-mono`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {/* 图片比例 - 仅支持的模型显示 */}
            {modelCapabilities.supportsImageSize && modelCapabilities.imageSizes && modelCapabilities.imageSizes.length > 0 && (
                <FormField
                    control={form.control}
                    name="imageSize"
                    render={({ field }) => {
                        const sizes = modelCapabilities.imageSizes || [];
                        const defaultSize = sizes[0] || "1024x1024";
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
                                        {sizes.map((sizeId: string) => (
                                            <SelectItem key={sizeId} value={sizeId}>
                                                {SIZE_DISPLAY_NAMES[sizeId] || sizeId}
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
                    <div className="border-t border-gray-100 my-2" />

                    {/* 高级参数标题 - 可折叠 */}
                    <div
                        className="flex items-center justify-between cursor-pointer py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">高级参数</h4>
                        {showAdvanced ? (
                            <ChevronUp className="w-3 h-3 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                        )}
                    </div>

                    {showAdvanced && (
                        <div className="mt-2 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* 引导系数 (CFG) - 仅支持的模型显示 */}
                            {modelCapabilities.cfgParam && (
                                <FormField
                                    control={form.control}
                                    name="cfg"
                                    render={({ field }) => {
                                        return (
                                            <FormItem>
                                                <div className="flex items-center justify-between">
                                                    <FormLabel className={LABEL_CLASS}>创意系数</FormLabel>
                                                    <span className="text-xs text-gray-600 font-mono">
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
                                                    <FormLabel className={LABEL_CLASS}>生成质量</FormLabel>
                                                    <span className="text-xs text-gray-600 font-mono">
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
                                <span className="ml-2 text-[9px] font-normal text-orange-500 normal-case">
                                    图生图
                                </span>
                            </div>
                            {Object.values(isUploading).some(Boolean) && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                        </div>

                        {/* 模式切换 */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    form.setValue("referenceImageMode", "variable");
                                    if (updateNodeData && selectedNodeId) {
                                        updateNodeData(selectedNodeId, { referenceImageMode: "variable" });
                                    }
                                }}
                                className={`flex-1 py-1.5 px-3 text-xs rounded-lg border transition-all ${form.watch("referenceImageMode") === "variable"
                                    ? "bg-blue-50 border-blue-300 text-blue-700"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                    }`}
                            >
                                📎 变量引用
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    form.setValue("referenceImageMode", "static");
                                    if (updateNodeData && selectedNodeId) {
                                        updateNodeData(selectedNodeId, { referenceImageMode: "static" });
                                    }
                                }}
                                className={`flex-1 py-1.5 px-3 text-xs rounded-lg border transition-all ${form.watch("referenceImageMode") !== "variable"
                                    ? "bg-blue-50 border-blue-300 text-blue-700"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                    }`}
                            >
                                📤 静态上传
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
                                    <FormField
                                        control={form.control}
                                        name="referenceImageVariable"
                                        render={({ field }) => (
                                            <input
                                                {...field}
                                                value={field.value || ""}
                                                placeholder="{{节点名.字段名}}（图片URL）"
                                                className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono"
                                            />
                                        )}
                                    />
                                    {form.watch("referenceImageVariable") && (
                                        <button
                                            type="button"
                                            onClick={() => form.setValue("referenceImageVariable", "")}
                                            className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
                                        >
                                            <span className="text-gray-400 hover:text-red-500 text-sm">×</span>
                                        </button>
                                    )}
                                </div>

                                {/* 副图2 - 动态显示 */}
                                {(form.watch("referenceImage2Variable") || showExtraImages >= 1) && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-gray-500 font-medium">2.</span>
                                            <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">副图</span>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="referenceImage2Variable"
                                            render={({ field }) => (
                                                <input
                                                    {...field}
                                                    value={field.value || ""}
                                                    placeholder="{{节点名.字段名}}（图片URL）"
                                                    className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono"
                                                />
                                            )}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                form.setValue("referenceImage2Variable", "");
                                                setShowExtraImages(prev => Math.max(0, prev - 1));
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
                                        >
                                            <span className="text-gray-400 hover:text-red-500 text-sm">×</span>
                                        </button>
                                    </div>
                                )}

                                {/* 副图3 - 动态显示 */}
                                {(form.watch("referenceImage3Variable") || showExtraImages >= 2) && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-gray-500 font-medium">3.</span>
                                            <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">副图</span>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="referenceImage3Variable"
                                            render={({ field }) => (
                                                <input
                                                    {...field}
                                                    value={field.value || ""}
                                                    placeholder="{{节点名.字段名}}（图片URL）"
                                                    className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 font-mono"
                                                />
                                            )}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                form.setValue("referenceImage3Variable", "");
                                                setShowExtraImages(prev => Math.max(1, prev - 1));
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
                                        >
                                            <span className="text-gray-400 hover:text-red-500 text-sm">×</span>
                                        </button>
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
                                            className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span>+</span>
                                            添加参考图
                                        </button>
                                    ) : null;
                                })()}

                                <p className="text-[9px] text-gray-400 pt-1">
                                    💡 融合多张图片特征生成新图，主图权重最高
                                </p>
                            </div>
                        ) : (
                            /* 静态上传模式 */
                            /* 静态上传模式 */
                            <div className="space-y-3">
                                {/* Slot 1: Main Image - Always Visible */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[10px] text-blue-600 font-medium">1.</span>
                                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">主图</span>
                                    </div>
                                    {currentRefImg1 || localPreviews['1'] ? (
                                        // Uploaded State
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                            <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                                                <img
                                                    src={localPreviews['1'] || currentRefImg1}
                                                    alt="参考图预览"
                                                    className="w-full h-full object-cover"
                                                />
                                                {isUploading['1'] && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-700 truncate">
                                                    {isUploading['1'] ? "上传中..." : "参考图已上传"}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteReferenceImage(1)}
                                                    disabled={isUploading['1']}
                                                    className="mt-1 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    删除
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Upload Area
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center transition-all duration-150 hover:border-gray-400 hover:bg-gray-50 cursor-pointer">
                                            <input
                                                ref={fileInputRef1}
                                                type="file"
                                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                                className="hidden"
                                                id="ref-img-1"
                                                onChange={(e) => handleReferenceImageUpload(e.target.files, 1)}
                                                disabled={isUploading['1']}
                                            />
                                            <label htmlFor="ref-img-1" className="cursor-pointer block">
                                                <ImagePlus className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                                                <div className="text-xs font-medium text-gray-600">点击上传主图</div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Slot 2: Sub Image */}
                                {(currentRefImg2 || showExtraImages >= 1) && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[10px] text-gray-500 font-medium">2.</span>
                                                <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">副图</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleDeleteReferenceImage(2);
                                                    setShowExtraImages(prev => Math.max(0, prev - 1));
                                                }}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <span className="text-xs">× 移除</span>
                                            </button>
                                        </div>

                                        {currentRefImg2 || localPreviews['2'] ? (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                                <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                                                    <img
                                                        src={localPreviews['2'] || currentRefImg2}
                                                        alt="参考图预览"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {isUploading['2'] && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-gray-700 truncate">
                                                        {isUploading['2'] ? "上传中..." : "参考图已上传"}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteReferenceImage(2)}
                                                        disabled={isUploading['2']}
                                                        className="mt-1 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        删除
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center transition-all duration-150 hover:border-gray-400 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    ref={fileInputRef2}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                                    className="hidden"
                                                    id="ref-img-2"
                                                    onChange={(e) => handleReferenceImageUpload(e.target.files, 2)}
                                                    disabled={isUploading['2']}
                                                />
                                                <label htmlFor="ref-img-2" className="cursor-pointer block">
                                                    <ImagePlus className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                                                    <div className="text-xs font-medium text-gray-600">点击上传副图</div>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Slot 3: Sub Image */}
                                {(currentRefImg3 || showExtraImages >= 2) && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[10px] text-gray-500 font-medium">3.</span>
                                                <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">副图</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleDeleteReferenceImage(3);
                                                    setShowExtraImages(prev => Math.max(1, prev - 1));
                                                }}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <span className="text-xs">× 移除</span>
                                            </button>
                                        </div>

                                        {currentRefImg3 || localPreviews['3'] ? (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                                <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                                                    <img
                                                        src={localPreviews['3'] || currentRefImg3}
                                                        alt="参考图预览"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {isUploading['3'] && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-gray-700 truncate">
                                                        {isUploading['3'] ? "上传中..." : "参考图已上传"}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteReferenceImage(3)}
                                                        disabled={isUploading['3']}
                                                        className="mt-1 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        删除
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center transition-all duration-150 hover:border-gray-400 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    ref={fileInputRef3}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                                    className="hidden"
                                                    id="ref-img-3"
                                                    onChange={(e) => handleReferenceImageUpload(e.target.files, 3)}
                                                    disabled={isUploading['3']}
                                                />
                                                <label htmlFor="ref-img-3" className="cursor-pointer block">
                                                    <ImagePlus className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                                                    <div className="text-xs font-medium text-gray-600">点击上传副图</div>
                                                </label>
                                            </div>
                                        )}
                                    </div>
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
                                            className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-1"
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
        </>
    );
}
