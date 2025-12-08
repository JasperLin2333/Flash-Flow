import type { AppNode, FlowContext, OutputNodeData, ContentSource, AttachmentSource, OutputInputMappings } from "@/types/flow";
import { BaseNodeExecutor, type ExecutionResult } from "./BaseNodeExecutor";
import { replaceVariables } from "@/lib/promptParser";
import { useFlowStore } from "@/store/flowStore";

/**
 * 从直接上游 context 中收集变量（不包含全局 flowContext）
 * 避免多 LLM 场景下的变量冲突
 */
function collectDirectUpstreamVariables(
  context: FlowContext,
  allNodes: AppNode[]
): Record<string, unknown> {
  const variables: Record<string, unknown> = {};

  for (const [nodeId, nodeOutput] of Object.entries(context)) {
    if (nodeId.startsWith('_')) continue;

    const node = allNodes.find(n => n.id === nodeId);
    const nodeLabel = node?.data?.label as string | undefined;

    if (typeof nodeOutput === 'object' && nodeOutput !== null) {
      const record = nodeOutput as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (key.startsWith('_')) continue;

        // 保留原始值类型（支持 files 数组等）
        variables[key] = value;

        // 带节点 label 前缀
        if (nodeLabel) {
          variables[`${nodeLabel}.${key}`] = value;
        }

        // 带节点 ID 前缀
        variables[`${nodeId}.${key}`] = value;
      }
    }
  }

  return variables;
}

/**
 * 将变量值转换为字符串
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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
 * 解析附件来源
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

    // 如果是文件数组
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
  async execute(node: AppNode, context: FlowContext, _mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const { result, time } = await this.measureTime(async () => {
      const nodeData = node.data as OutputNodeData;
      const inputMappings = nodeData?.inputMappings as OutputInputMappings | undefined;

      // 获取所有节点信息
      const { nodes: allNodes } = useFlowStore.getState();

      // 收集变量（保留原始类型）
      const variables = collectDirectUpstreamVariables(context, allNodes);

      // 转换为字符串版本（用于模板替换）
      const stringVariables: Record<string, string> = {};
      for (const [key, value] of Object.entries(variables)) {
        stringVariables[key] = valueToString(value);
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
          // 分支选择：取第一个非空结果
          if (sources.length === 0) {
            throw new Error('Output 节点配置错误：select 模式需要至少配置一个来源 (sources)');
          }
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
          text = replaceVariables(template, stringVariables, false);
          break;
        }

        default:
          throw new Error(`Output 节点配置错误：未知的输出模式 "${mode}"`);
      }

      // 处理附件
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
