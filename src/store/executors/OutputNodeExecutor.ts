import type { AppNode, FlowContext, OutputNodeData, ContentSource, AttachmentSource } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";
import { useFlowStore } from "@/store/flowStore";
import { collectVariablesRaw } from "./utils/variableUtils";
import { getMimeType, valueToString } from "@/utils/mimeUtils";


/**
 * 解析单个 source 的值
 */
function resolveSource(
  source: ContentSource,
  variables: Record<string, unknown>,
  stringVariables: Record<string, string>
): string {
  if (source.type === 'static') {
    return source.value;
  }
  // variable 类型：解析 {{变量名}} 语法
  return replaceVariables(source.value, stringVariables, false);
}

/**
 * 判断 URL 是否为图片 URL
 * 支持通过文件扩展名或 Supabase Storage URL 判断
 */
function isImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  // 检查常见图片扩展名
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|$)/i.test(url)) return true;
  // 检查 Supabase Storage URL（生成的图片通常存储在这里）
  if (url.includes('supabase') && url.includes('/storage/')) return true;
  return false;
}

/**
 * 解析附件来源
 * 支持文件数组 (files)、单个文件对象 (generatedFile)、imageUrl 字符串
 */
function resolveAttachments(
  attachments: AttachmentSource[] | undefined,
  variables: Record<string, unknown>
): { name: string; url: string; type?: string }[] {
  if (!attachments || attachments.length === 0) return [];

  const result: { name: string; url: string; type?: string }[] = [];

  for (const attachment of attachments) {
    if (attachment.type === 'static') {
      // 静态附件（URL）- 暂不支持，预留
      continue;
    }

    // 解析变量引用，提取变量名
    const varMatch = attachment.value.match(/\{\{(.+?)\}\}/);
    if (!varMatch) continue;

    const varName = varMatch[1];
    const value = variables[varName];

    // [Dev Check] Warn if variable not found
    if (value === undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[OutputNode] Attachment variable not found: ${varName}`);
      }
      continue;
    }

    // 处理文件数组 (如 {{用户输入.files}})
    if (Array.isArray(value)) {
      for (const file of value) {
        if (typeof file === 'object' && file !== null && 'name' in file) {
          result.push({
            name: (file as { name: string }).name,
            url: (file as { url?: string }).url || '',
            type: (file as { type?: string }).type
          });
        }
      }
    }
    // 处理单个文件对象 (如 {{代码执行.generatedFile}})
    else if (typeof value === 'object' && value !== null && 'name' in value && 'url' in value) {
      const file = value as { name: string; url: string; type?: string };
      result.push({
        name: file.name,
        url: file.url,
        type: file.type
      });
    }
    // 处理 imageUrl 字符串 (如 {{图片生成.imageUrl}})
    else if (typeof value === 'string' && isImageUrl(value)) {
      // 从 URL 中提取文件名，或生成默认名称
      const urlPath = value.split('?')[0];
      const fileName = urlPath.split('/').pop() || `generated_image_${Date.now()}.png`;
      const mimeType = getMimeType(urlPath);
      result.push({
        name: fileName,
        url: value,
        type: mimeType === 'application/octet-stream' ? 'image/png' : mimeType
      });
    }
  }

  return result;
}


/**
 * Output 节点执行器
 * 
 * 支持四种模式:
 * - direct: 直接引用单一来源
 * - select: 分支选择（取第一个非空）
 * - merge: 内容合并（连接多个来源）
 * - template: 模板渲染（自定义格式）
 * 
 * 所有模式都支持可选的 attachments 配置
 */
export class OutputNodeExecutor extends BaseNodeExecutor {
  async execute(node: AppNode, context: FlowContext): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      const nodeData = node.data as OutputNodeData;
      const inputMappings = nodeData?.inputMappings;

      // 获取所有节点信息和全局 flowContext
      const { nodes: allNodes, flowContext: globalFlowContext } = useFlowStore.getState();

      // 收集全局变量（保留原始类型）- 支持引用任意已执行节点
      const variables = collectVariablesRaw(context, globalFlowContext, allNodes);

      // 转换为字符串版本（用于模板替换）
      const stringVariables: Record<string, string> = {};
      for (const [key, value] of Object.entries(variables)) {
        stringVariables[key] = valueToString(value);
      }

      // 支持调试模式：注入 mock 数据
      const mockData = context.mock as Record<string, unknown> | undefined;
      if (mockData && typeof mockData === 'object') {
        for (const [key, value] of Object.entries(mockData)) {
          stringVariables[key] = valueToString(value);
          variables[key] = value;
        }
      }

      // 默认模式为 direct
      const mode = inputMappings?.mode || 'direct';
      const sources = inputMappings?.sources || [];
      const template = inputMappings?.template || '';

      let text = "";

      switch (mode) {
        case 'direct': {
          // 直接引用：使用第一个 source
          if (sources.length === 0) {
            throw new Error('Output 节点配置错误：direct 模式需要至少配置一个来源 (sources)');
          }
          text = resolveSource(sources[0], variables, stringVariables);
          break;
        }

        case 'select': {
          // 分支选择：优先使用流式锁定的源，否则取第一个非空结果
          if (sources.length === 0) {
            throw new Error('Output 节点配置错误：select 模式需要至少配置一个来源 (sources)');
          }

          // 优先使用流式锁定的源（如果存在）
          const { lockedSourceId } = useFlowStore.getState();
          if (lockedSourceId) {
            // 查找锁定源对应的节点
            const lockedNode = allNodes.find(n => n.id === lockedSourceId);
            if (lockedNode) {
              const lockedLabel = (lockedNode.data?.label as string) || lockedSourceId;
              // 尝试从锁定节点获取 response（支持 label 和 ID 两种前缀）
              const lockedResponse = stringVariables[`${lockedLabel}.response`]
                || stringVariables[`${lockedSourceId}.response`]
                || stringVariables['response'];  // 回退到无前缀
              if (lockedResponse && lockedResponse.trim() && !lockedResponse.includes('{{')) {
                text = lockedResponse;
                break;
              }
            }
          }

          // 回退：按配置顺序选择第一个非空
          for (const source of sources) {
            const resolved = resolveSource(source, variables, stringVariables);
            if (resolved && resolved.trim() && !resolved.includes('{{')) {
              text = resolved;
              break;
            }
          }
          break;
        }

        case 'merge': {
          // 内容合并：连接所有非空结果
          if (sources.length === 0) {
            throw new Error('Output 节点配置错误：merge 模式需要至少配置一个来源 (sources)');
          }
          const parts: string[] = [];
          for (const source of sources) {
            const resolved = resolveSource(source, variables, stringVariables);
            if (resolved && resolved.trim() && !resolved.includes('{{')) {
              parts.push(resolved);
            }
          }
          text = parts.join('\n\n');
          break;
        }

        case 'template': {
          // 模板渲染：替换模板中的变量
          if (!template) {
            throw new Error('Output 节点配置错误：template 模式需要配置模板内容 (template)');
          }
          // 直接使用已收集的全局变量
          text = replaceVariables(template, stringVariables, false);
          break;
        }

        default:
          throw new Error(`Output 节点配置错误：未知的输出模式 "${mode}"`);
      }

      // 处理附件（使用已收集的全局变量）
      const attachments = resolveAttachments(inputMappings?.attachments, variables);

      // 构建输出
      const output: { text: string; attachments?: { name: string; url: string; type?: string }[] } = { text };
      if (attachments.length > 0) {
        output.attachments = attachments;
      }

      return output;
    });

    return {
      output: result,
      executionTime: time
    };
  }
}
