"use client";
import { useMemo } from "react";
import type { NodeKind, AppEdge, AppNode } from "@/types/flow";
import type { NodeIOSectionProps, UpstreamVariable, UpstreamInputState, ReferencedVariable } from "../../types";
import {
    NODE_OUTPUT_FIELDS,
    TOOL_IO_DEFINITIONS,
    NODE_UPSTREAM_INPUTS,
} from "../../constants";
import { extractVariablesFromText, flattenObjectToVariables } from "../../utils";

// 输出字段类型
export interface OutputField {
    field: string;
    description: string;
}

// Hook 返回值类型
export interface UseNodeIOResult {
    upstreamVariables: UpstreamVariable[];
    outputFields: OutputField[];
    upstreamInputs: UpstreamInputState[];
    referencedVariables: ReferencedVariable[];
    isEntryNode: boolean;
}

/**
 * 节点输入输出计算逻辑 Hook
 * 封装所有 useMemo 计算逻辑
 */
export function useNodeIO({
    nodeId,
    nodeType,
    nodeData,
    nodes,
    edges,
    flowContext,
}: Pick<NodeIOSectionProps, 'nodeId' | 'nodeType' | 'nodeData' | 'nodes' | 'edges' | 'flowContext'>): UseNodeIOResult {

    // 计算上游节点及其可用变量
    const upstreamVariables = useMemo((): UpstreamVariable[] => {
        const variables: UpstreamVariable[] = [];

        // 找到所有上游节点
        const incomingEdges = edges.filter(e => e.target === nodeId);
        const upstreamNodeIds = new Set(incomingEdges.map(e => e.source));

        // 递归获取所有上游节点（包括间接上游）
        const getAllUpstream = (currentId: string, visited: Set<string>): void => {
            if (visited.has(currentId)) return;
            visited.add(currentId);

            const incoming = edges.filter(e => e.target === currentId);
            incoming.forEach(e => {
                upstreamNodeIds.add(e.source);
                getAllUpstream(e.source, visited);
            });
        };

        incomingEdges.forEach(e => getAllUpstream(e.source, new Set()));

        // 收集每个上游节点的输出字段
        upstreamNodeIds.forEach(upId => {
            const upNode = nodes.find(n => n.id === upId);
            if (!upNode) return;

            const upLabel = (upNode.data?.label as string) || upNode.type || upId;
            const upOutput = flowContext[upId] as Record<string, unknown> | undefined;
            const upCustomOutputs = (upNode.data as Record<string, unknown>)?.customOutputs as { name: string; value: string }[] | undefined;

            // 获取该节点类型的标准输出字段
            const outputFields = NODE_OUTPUT_FIELDS[upNode.type as NodeKind] || [];

            // 如果有实际执行输出，递归展开所有字段（包括嵌套对象）
            if (upOutput && typeof upOutput === 'object') {
                const flattened = flattenObjectToVariables(upOutput as Record<string, unknown>, upLabel, upId);
                variables.push(...flattened);
            } else {
                // 没有执行输出时，显示预期字段
                outputFields.forEach(({ field }) => {
                    // 跳过 formData 和 files 字段，后面会动态生成
                    if (field === 'formData' || field === 'files') return;
                    if (!field.startsWith('(')) {
                        variables.push({
                            nodeLabel: upLabel,
                            nodeId: upId,
                            field,
                        });
                    }
                });

                // 对于 Input 节点，动态生成表单字段变量和文件字段变量
                if (upNode.type === 'input') {
                    const upNodeData = upNode.data as Record<string, unknown>;

                    // 从 formFields 配置生成表单变量
                    const formFields = upNodeData?.formFields as Array<{ name: string; label: string }> | undefined;
                    if (formFields && formFields.length > 0) {
                        formFields.forEach(formField => {
                            variables.push({
                                nodeLabel: upLabel,
                                nodeId: upId,
                                field: `formData.${formField.name}`,
                                value: formField.label, // 显示字段标签作为提示
                            });
                        });
                    }

                    // 如果启用了文件上传，生成 files 数组引用变量
                    const enableFileInput = upNodeData?.enableFileInput as boolean | undefined;
                    if (enableFileInput) {
                        // 1. 添加 files 整体变量（用于 RAG 动态模式的 inputMappings.files）
                        variables.push({
                            nodeLabel: upLabel,
                            nodeId: upId,
                            field: 'files',
                            value: '文件数组 (用于RAG动态模式)',
                        });
                        // 2. 生成预期的 files 数组属性变量（使用 files[n] 格式，用于 LLM/Tool 引用）
                        const fileProps = ['name', 'type', 'size', 'url'];
                        fileProps.forEach(prop => {
                            variables.push({
                                nodeLabel: upLabel,
                                nodeId: upId,
                                field: `files[n].${prop}`,
                                value: `文件属性: ${prop}`,
                            });
                        });
                    }
                }
            }

            // 添加上游节点的自定义输出变量
            if (upCustomOutputs && upCustomOutputs.length > 0) {
                upCustomOutputs.forEach(cv => {
                    variables.push({
                        nodeLabel: upLabel,
                        nodeId: upId,
                        field: cv.name,
                        value: cv.value.length > 50 ? cv.value.slice(0, 50) + '...' : cv.value,
                    });
                });
            }
        });

        return variables;
    }, [nodeId, nodes, edges, flowContext]);

    // 当前节点的输出字段定义（根据节点类型动态生成）
    const outputFields = useMemo((): OutputField[] => {
        if (nodeType === 'tool') {
            // Tool 节点：根据工具类型获取输出字段
            const toolType = nodeData?.toolType as string | undefined;
            if (toolType && TOOL_IO_DEFINITIONS[toolType]) {
                return TOOL_IO_DEFINITIONS[toolType].outputs.map(o => ({
                    field: o.field,
                    description: o.description,
                }));
            }
            return [{ field: "(请先选择工具类型)", description: "" }];
        }
        return NODE_OUTPUT_FIELDS[nodeType] || [];
    }, [nodeType, nodeData?.toolType]);

    // 计算当前节点需要的上游输入（检查是否满足）
    const upstreamInputs = useMemo((): UpstreamInputState[] => {
        const inputs: UpstreamInputState[] = [];
        const upstreamFieldNames = new Set(upstreamVariables.map(v => v.field));
        // 同时记录带节点名前缀的变量（如 节点名.field）
        const upstreamFullNames = new Set(upstreamVariables.map(v => `${v.nodeLabel}.${v.field}`));
        // 记录节点 ID 前缀的变量（如 nodeId.field）
        const upstreamIdNames = new Set(upstreamVariables.map(v => `${v.nodeId}.${v.field}`));

        // 验证变量引用是否有效
        const validateVarRefs = (value: string): boolean => {
            const vars = extractVariablesFromText(value);
            if (vars.length === 0) return true; // 没有变量引用，不需要验证

            // 将 files[数字] 格式转换为 files[n] 进行验证
            const normalizeArrayIndex = (str: string): string => {
                return str.replace(/\[(\d+)\]/g, '[n]');
            };

            return vars.every(varName => {
                // 先尝试直接匹配
                if (upstreamFieldNames.has(varName)) return true;
                if (upstreamFullNames.has(varName)) return true;
                if (upstreamIdNames.has(varName)) return true;

                // 尝试将数组索引标准化后匹配（如 files[0].name -> files[n].name）
                const normalizedVarName = normalizeArrayIndex(varName);
                if (normalizedVarName !== varName) {
                    if (upstreamFieldNames.has(normalizedVarName)) return true;
                    if (upstreamFullNames.has(normalizedVarName)) return true;
                    if (upstreamIdNames.has(normalizedVarName)) return true;
                }

                // 如果包含点号，尝试解析为 nodePrefix.fieldPath 格式
                if (varName.includes('.')) {
                    const parts = varName.split('.');
                    const [prefix, ...restParts] = parts;
                    const fieldPath = restParts.join('.');
                    const normalizedFieldPath = normalizeArrayIndex(fieldPath);

                    // 检查是否有任何上游变量的节点名或 ID 匹配 prefix，且字段路径匹配
                    return upstreamVariables.some(v =>
                        (v.nodeLabel === prefix || v.nodeId === prefix) &&
                        (v.field === fieldPath || v.field === normalizedFieldPath)
                    );
                }
                return false;
            });
        };

        if (nodeType === 'tool') {
            // Tool 节点：根据工具类型获取输入参数需求
            const toolType = nodeData?.toolType as string | undefined;
            if (toolType && TOOL_IO_DEFINITIONS[toolType]) {
                const toolDef = TOOL_IO_DEFINITIONS[toolType];
                const configuredInputs = nodeData?.inputs as Record<string, unknown> | undefined;
                toolDef.inputs.forEach(inp => {
                    const configuredValue = configuredInputs?.[inp.field];
                    const valueStr = configuredValue !== undefined ? String(configuredValue) : '';
                    // 检查变量引用是否有效
                    const hasVarRef = valueStr.includes('{{');
                    const varsValid = hasVarRef ? validateVarRefs(valueStr) : true;
                    const hasInvalidVars = hasVarRef && !varsValid;
                    // 检查是否已配置值或引用了变量
                    const hasValue = valueStr !== '';
                    const isSatisfied = hasValue && varsValid;
                    inputs.push({
                        field: inp.field,
                        description: inp.description,
                        required: inp.required,
                        isSatisfied,
                        configuredValue: valueStr,
                        isToolInput: true,
                        hasInvalidVars,
                    });
                });
            }
        } else {
            // 其他节点：使用静态上游输入定义，必须显式配置 inputMappings
            const upstreamDefs = NODE_UPSTREAM_INPUTS[nodeType] || [];
            const inputMappings = (nodeData?.inputMappings as Record<string, string>) || {};
            upstreamDefs.forEach(def => {
                const configuredValue = inputMappings[def.field] || '';
                // 检查变量引用是否有效
                const hasVarRef = configuredValue.includes('{{');
                const varsValid = hasVarRef ? validateVarRefs(configuredValue) : true;
                const hasInvalidVars = hasVarRef && !varsValid;
                // 检查是否已配置值（必须显式配置）
                const hasConfig = configuredValue !== '' && varsValid;
                const isSatisfied = hasConfig ||
                    def.field.includes('*') || // 通配符始终视为可能满足
                    !def.required;
                inputs.push({
                    field: def.field,
                    description: def.description,
                    required: def.required,
                    isSatisfied: isSatisfied && !hasInvalidVars,
                    configuredValue,
                    isToolInput: false,
                    hasInvalidVars,
                });
            });
        }

        return inputs;
    }, [nodeType, nodeData, upstreamVariables]);

    // 计算当前节点引用的变量（动态检测）
    const referencedVariables = useMemo((): ReferencedVariable[] => {
        const refs: ReferencedVariable[] = [];
        const upstreamFieldNames = new Set(upstreamVariables.map(v => v.field));
        const upstreamFullNames = new Set(upstreamVariables.map(v => `${v.nodeLabel}.${v.field}`));

        // LLM 节点：检测 systemPrompt 中的变量
        if (nodeType === 'llm') {
            const systemPrompt = nodeData?.systemPrompt as string | undefined;
            if (systemPrompt) {
                const vars = extractVariablesFromText(systemPrompt);
                vars.forEach(varName => {
                    const isSatisfied = upstreamFieldNames.has(varName) ||
                        upstreamFullNames.has(varName) ||
                        varName.includes('.');
                    refs.push({
                        field: varName,
                        description: "systemPrompt 中引用",
                        isSatisfied,
                    });
                });
            }
        }

        // Tool 节点：检测工具输入参数中的变量
        if (nodeType === 'tool') {
            const toolInputs = nodeData?.inputs as Record<string, unknown> | undefined;
            if (toolInputs) {
                Object.entries(toolInputs).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        const vars = extractVariablesFromText(value);
                        vars.forEach(varName => {
                            const isSatisfied = upstreamFieldNames.has(varName) ||
                                upstreamFullNames.has(varName) ||
                                varName.includes('.');
                            refs.push({
                                field: varName,
                                description: `参数 ${key} 中引用`,
                                isSatisfied,
                            });
                        });
                    }
                });
            }
        }

        // Branch 节点：检测条件表达式中的变量引用
        // 支持格式: nodeName.field (如 用户输入.user_input, LLM处理.response)
        if (nodeType === 'branch') {
            const condition = nodeData?.condition as string | undefined;
            if (condition) {
                // 匹配 nodeName.field 格式 (nodeName 可以是中文或英文)
                const nodeFieldRegex = /([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*)\.(\w+)/g;
                let match;
                while ((match = nodeFieldRegex.exec(condition)) !== null) {
                    const nodeName = match[1];
                    const fieldName = match[2];
                    const fullRef = `${nodeName}.${fieldName}`;
                    // 检查是否有匹配的上游变量
                    const isSatisfied = upstreamFullNames.has(fullRef) ||
                        upstreamVariables.some(v => v.nodeLabel === nodeName && v.field === fieldName);
                    refs.push({
                        field: fullRef,
                        description: "条件表达式中引用",
                        isSatisfied,
                    });
                }
            }
        }

        return refs;
    }, [nodeType, nodeData, upstreamVariables]);

    // 如果是入口节点（没有上游），不显示输入部分
    const isEntryNode = nodeType === 'input';

    return {
        upstreamVariables,
        outputFields,
        upstreamInputs,
        referencedVariables,
        isEntryNode,
    };
}
