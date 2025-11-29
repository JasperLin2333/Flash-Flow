/**
 * FlowCard 组件工具函数
 * 包含时间格式化、图标渲染、文件上传等辅助逻辑
 */

import type { FlowRecord } from "@/types/flow";

/**
 * 计算相对时间字符串（如"5m ago"、"2h ago"）
 * @param isoDateString - ISO 格式的日期字符串
 * @returns 相对时间字符串
 */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  
  if (mins < 60) return `${mins}m ago`;
  
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.round(hours / 24);
  return `${days}d ago`;
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
    const path = `${ownerId}/${flowId}/${Date.now()}-${file.name}`;

    // 动态导入 Supabase 客户端（避免循环依赖）
    const { supabase } = await import("@/lib/supabase");

    // 上传文件
    const { error: uploadError } = await supabase
      .storage.from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    // 获取公开 URL
    const { data } = supabase
      .storage.from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (error) {
    console.error("File upload failed:", error);
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
