/**
 * ImageGen 节点常量配置
 * 
 * 用于节点卡片元数据显示的模型名称和尺寸映射
 */

// 图像生成模型名称映射（model_id → 中文显示名）
export const IMAGEGEN_MODEL_NAMES: Record<string, string> = {
    "Kwai-Kolors/Kolors": "可灵",
    "Qwen/Qwen-Image": "千问-文生图",
    "Qwen/Qwen-Image-Edit-2509": "千问-图生图",
    "black-forest-labs/FLUX.1-schnell": "FLUX.1 快速",
    "stabilityai/stable-diffusion-3-5-large-turbo": "SD 3.5 Turbo",
};

// 图像尺寸比例映射（尺寸 → 比例显示，用于元数据）
export const IMAGEGEN_SIZE_NAMES: Record<string, string> = {
    // Kolors / Common
    "1024x1024": "1:1",
    "960x1280": "3:4",
    "768x1024": "3:4",
    "720x1440": "1:2",
    "720x1280": "9:16",
    "1024x768": "4:3",
    "1024x512": "2:1",
    "512x1024": "1:2",
    // Qwen
    "1328x1328": "1:1",
    "1664x928": "16:9",
    "928x1664": "9:16",
    "1472x1140": "4:3",
    "1140x1472": "3:4",
    "1584x1056": "3:2",
    "1056x1584": "2:3",
};

// 尺寸 ID 到中文名映射（用于表单/对话框下拉选项）
// 基于 IMAGEGEN_SIZE_NAMES 生成，避免重复定义
const SIZE_ORIENTATION_SUFFIXES: Record<string, string> = {
    "1:1": "正方形",
    "3:4": "竖版",
    "1:2": "竖版",
    "9:16": "竖版",
    "4:3": "横版",
    "2:1": "横版",
    "16:9": "横版",
    "3:2": "横版",
    "2:3": "竖版",
};

export const SIZE_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
    Object.entries(IMAGEGEN_SIZE_NAMES).map(([size, ratio]) => [
        size,
        `${ratio} ${SIZE_ORIENTATION_SUFFIXES[ratio] || ""}`
    ])
);

// ImageGen 配置常量（用于表单和 Hook）
export const IMAGEGEN_CONFIG = {
    // 默认模型
    DEFAULT_MODEL: "Kwai-Kolors/Kolors",
    // 默认参数值
    DEFAULT_CFG: 7.5,
    DEFAULT_STEPS: 25,
    DEFAULT_IMAGE_SIZE: "1024x1024",
    // 推理步数配置 (Fallback defaults)
    STEPS_MIN_DEFAULT: 1,
    STEPS_MAX_DEFAULT: 50,
    // Quality slider range
    QUALITY_MIN: 1,
    QUALITY_MAX: 100,
    // CFG 滑块步进
    CFG_STEP: 0.1,
} as const;

/**
 * 获取模型显示名称
 */
export function getImageGenModelName(modelId: string | undefined): string {
    if (!modelId) return "可灵";
    return IMAGEGEN_MODEL_NAMES[modelId] || modelId.split('/').pop() || modelId;
}

/**
 * 获取尺寸比例显示
 */
export function getImageGenSizeName(imageSize: string | undefined): string {
    if (!imageSize) return "1:1";
    return IMAGEGEN_SIZE_NAMES[imageSize] || imageSize;
}

