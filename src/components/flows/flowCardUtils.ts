/**
 * FlowCard 组件工具函数
 * 包含时间格式化、图标渲染、文件上传等辅助逻辑
 */

import type { FlowRecord } from "@/types/flow";

/**
 * 格式化更新时间为 "YYYY/MM/DD HH:MM:SS" 格式
 * @param isoDateString - ISO 格式的日期字符串
 * @returns 格式化后的时间字符串
 */
export function formatUpdateTime(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化为相对时间（如：刚刚、2分钟前、1小时前、3天前）
 * @param isoDateString - ISO 格式的日期字符串
 * @returns 相对时间字符串
 */
export function formatRelativeTime(isoDateString: string): string {
  const date = new Date(isoDateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return '刚刚';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}小时前`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}天前`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}周前`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}个月前`;
  }

  return `${Math.floor(diffInMonths / 12)}年前`;
}

/**
 * 获取流程节点数量
 * @param flow - 流程记录
 * @returns 节点数量
 */
export function getNodeCount(flow: FlowRecord): number {
  return flow.node_count ?? (flow.data?.nodes?.length || 0);
}

/**
 * 文件上传到 Supabase 存储桶
 * @param file - 要上传的文件
 * @param flowId - 流程 ID
 * @param ownerId - 所有者 ID
 * @returns 上传后的公开 URL，失败时返回 null
 */
export async function uploadFlowIcon(
  file: File,
  flowId: string,
  ownerId: string
): Promise<string | null> {
  try {
    const bucket = "flow-icons";

    // Sanitize filename: extract extension and use timestamp as filename
    // This avoids issues with non-ASCII characters in Supabase Storage
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeFileName = `${Date.now()}.${ext}`;
    const path = `${ownerId}/${flowId}/${safeFileName}`;

    // 动态导入 Supabase 客户端（避免循环依赖）
    const { supabase } = await import("@/lib/supabase");

    // console.log("[uploadFlowIcon] Uploading to:", { bucket, path, ownerId, flowId });

    // 上传文件
    const { error: uploadError } = await supabase
      .storage.from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("[uploadFlowIcon] Upload error:", uploadError);
      throw uploadError;
    }

    // console.log("[uploadFlowIcon] Upload success:", uploadData);

    // 获取公开 URL
    const { data } = supabase
      .storage.from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (error) {
    console.error("[uploadFlowIcon] File upload failed:", error);
    return null;
  }
}

/**
 * 验证文件类型是否为支持的图片格式
 * @param file - 要验证的文件
 * @returns 是否有效
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];
  return validTypes.includes(file.type);
}

/**
 * 获取支持的图片格式提示文本
 */
export const SUPPORTED_IMAGE_FORMATS = "PNG、JPG、JPEG、WEBP、GIF";
