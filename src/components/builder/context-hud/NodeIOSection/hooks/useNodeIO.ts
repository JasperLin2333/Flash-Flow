"use client";
import { useMemo } from "react";
import type { NodeKind } from "@/types/flow";
import type { NodeIOSectionProps, UpstreamVariable, UpstreamInputState, ReferencedVariable } from "../../types";
import {
    NODE_OUTPUT_FIELDS,
    TOOL_IO_DEFINITIONS,
    NODE_UPSTREAM_INPUTS,
} from "../../constants";
import { extractVariablesFromText, flattenObjectToVariables, flattenInputNodeOutput } from "../../utils";

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

            // 获取该节点类型的标准输出字段
            // 对于 Tool 节点，需要根据 toolType 动态获取输出字段
            let outputFields: { field: string; description?: string }[] = [];
            if (upNode.type === 'tool') {
                const toolType = (upNode.data as Record<string, unknown>)?.toolType as string | undefined;
                if (toolType && TOOL_IO_DEFINITIONS[toolType]) {
                    outputFields = TOOL_IO_DEFINITIONS[toolType].outputs;
                }
            } else {
                outputFields = NODE_OUTPUT_FIELDS[upNode.type as NodeKind] || [];
            }

            // 如果有实际执行输出，根据节点类型展开字段
            if (upOutput && typeof upOutput === 'object') {
                if (upNode.type === 'input') {
                    // Input 节点使用简化展开（只显示 user_input, files, files[n], formData.字段名）
                    const simplified = flattenInputNodeOutput(
                        upOutput as Record<string, unknown>,
                        upLabel,
                        upId,
                        upNode.data as Record<string, unknown>
                    );
                    variables.push(...simplified);
                } else {
                    // 其他节点类型使用通用的递归展开
                    const flattened = flattenObjectToVariables(upOutput as Record<string, unknown>, upLabel, upId);
                    // FIX: 过滤掉 reasoning 字段
                    const filtered = flattened.filter(v => v.field !== 'reasoning' && !v.field.startsWith('reasoning.'));
                    variables.push(...filtered);
                }
            } else {
                // 没有执行输出时，显示预期字段
                outputFields.forEach(({ field }) => {
                    // 跳过 formData 和 files 字段，后面会动态生成
                    if (field === 'formData' || field === 'files') return;

                    // 针对 Input 节点的 user_input 字段进行动态过滤
                    if (upNode.type === 'input' && field === 'user_input') {
                        const upNodeData = upNode.data as Record<string, unknown>;
                        const enableTextInput = upNodeData?.enableTextInput as boolean | undefined;
                        // enableTextInput 默认为 true，只有显式设置为 false 时才过滤
                        if (enableTextInput === false) return;
                    }

                    // 针对 LLM 节点的 reasoning 字段进行动态过滤
                    if (upNode.type === 'llm' && field === 'reasoning') {
                        // 始终过滤掉 reasoning，不在前端显示
                        return;
                    }

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

                    // 从 formFields 配置生成表单变量(修复丢失的定义)
                    const enableStructuredForm = upNodeData?.enableStructuredForm as boolean | undefined;
                    const formFields = upNodeData?.formFields as Array<{ name: string; label: string }> | undefined;

                    if (enableStructuredForm && formFields && formFields.length > 0) {
                        formFields.forEach(formField => {
                            // 添加友好显示的变量（使用 label 作为字段名）
                            // 这样用户在列表中看到的是 label，复制的也是 label
                            // 后端 variableUtils 已支持 label 解析，所以这是安全的
                            variables.push({
                                nodeLabel: upLabel,
                                nodeId: upId,
                                field: `formData.${formField.label}`,
                                // value: `变量名: ${formField.name}`, // 移除提示，保持界面整洁
                            });
                        });
                    }

                    // 标记自动生成的 raw formData 变量为隐藏
                    // 这些变量保留在列表中是为了验证逻辑 (validateVarRefs) 能通过
                    // 但不在 UI 中显示给用户
                    variables.forEach(v => {
                        if (v.nodeId === upId && v.field.startsWith('formData.')) {
                            // 检查这是否是我们要显示的 label 变量
                            const isLabelVar = formFields?.some(f => `formData.${f.label}` === v.field);
                            if (!isLabelVar) {
                                v.hidden = true;
                            }
                        }
                    });

                    // 如果启用了文件上传，生成 files 数组引用变量
                    const enableFileInput = upNodeData?.enableFileInput as boolean | undefined;
                    if (enableFileInput) {
                        // 1. 添加 files 整体变量（用于 RAG 动态模式的 inputMappings.files）
                        variables.push({
                            nodeLabel: upLabel,
                            nodeId: upId,
                            field: 'files',
                            value: '全部附件 (文件数组)',
                        });
                        // 2. 添加单个文件引用变量
                        variables.push({
                            nodeLabel: upLabel,
                            nodeId: upId,
                            field: 'files[n]',
                            value: '单个附件 (自动提取内容)',
                        });
                    }
                }
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

        // Input 节点：根据启用的功能动态过滤输出字段
        if (nodeType === 'input') {
            const baseFields = NODE_OUTPUT_FIELDS[nodeType] || [];
            const enableTextInput = nodeData?.enableTextInput as boolean | undefined;
            const enableFileInput = nodeData?.enableFileInput as boolean | undefined;
            const enableStructuredForm = nodeData?.enableStructuredForm as boolean | undefined;

            return baseFields.filter(field => {
                // user_input 字段只在 enableTextInput 不为 false 时显示（默认启用）
                if (field.field === 'user_input') {
                    return enableTextInput !== false;
                }
                // files 字段只在 enableFileInput 为 true 时显示
                if (field.field === 'files') {
                    return enableFileInput === true;
                }
                // formData 字段只在 enableStructuredForm 为 true 时显示
                if (field.field === 'formData') {
                    return enableStructuredForm === true;
                }
                // 其他字段始终显示
                return true;
            });
        }

        const fields = NODE_OUTPUT_FIELDS[nodeType] || [];

        // 针对当前 LLM 节点的 reasoning 字段进行动态过滤
        if (nodeType === 'llm') {
            // 始终隐藏 reasoning 字段
            return fields.filter(f => f.field !== 'reasoning');
        }

        // Output 节点：如果配置了 attachments，添加 attachments 输出字段
        if (nodeType === 'output') {
            const inputMappings = nodeData?.inputMappings as {
                attachments?: Array<{ type: string; value: string }>;
            } | undefined;

            // 检查是否有有效的 attachments 配置（至少有一个非空附件）
            const hasAttachments = inputMappings?.attachments?.some(a => a.value?.trim());

            if (hasAttachments) {
                return [
                    ...fields,
                    { field: 'attachments', description: '附件列表（文件/图片）' }
                ];
            }
        }

        return fields;
    }, [nodeType, nodeData?.toolType, nodeData?.enableTextInput, nodeData?.enableFileInput, nodeData?.enableStructuredForm, nodeData?.inputMappings]);

    // 计算当前节点的参数配置（检查是否满足）
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
                    let isRequired = inp.required;

                    // 特殊处理 datetime 工具的动态必填逻辑
                    if (toolType === 'datetime') {
                        const operation = (configuredInputs?.['operation'] as string) || 'now';
                        if (inp.field === 'date') {
                            isRequired = ['format', 'diff', 'add'].includes(operation);
                        } else if (inp.field === 'targetDate') {
                            isRequired = operation === 'diff';
                        } else if (inp.field === 'amount' || inp.field === 'unit') {
                            isRequired = operation === 'add';
                        } else if (inp.field === 'format') {
                            isRequired = operation === 'format';
                        }
                    }

                    inputs.push({
                        field: inp.field,
                        description: inp.description,
                        required: isRequired,
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

            const inputMappings = nodeData?.inputMappings as Record<string, string> | undefined;
            if (inputMappings?.user_input) {
                const vars = extractVariablesFromText(inputMappings.user_input);
                vars.forEach(varName => {
                    const isSatisfied = upstreamFieldNames.has(varName) ||
                        upstreamFullNames.has(varName) ||
                        varName.includes('.');
                    refs.push({
                        field: varName,
                        description: "用户提示词中引用",
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
        // 支持格式: nodeName.field 或 nodeName.formData.字段 (nodeName/字段 可以是中文或英文，包含括号等特殊字符)
        if (nodeType === 'branch') {
            const condition = nodeData?.condition as string | undefined;
            if (condition) {
                // 匹配 nodeName.field.subfield... 格式
                // nodeName: 中英文、下划线、数字开头
                // field path: 允许多级点分隔，每级允许中英文、数字、下划线、括号、空格等
                const nodeFieldRegex = /([a-zA-Z\u4e00-\u9fa5_][\w\u4e00-\u9fa5]*)\.([\w\u4e00-\u9fa5（）\(\)\s]+(?:\.[\w\u4e00-\u9fa5（）\(\)\s]+)*)/g;
                let match;
                while ((match = nodeFieldRegex.exec(condition)) !== null) {
                    const nodeName = match[1];
                    const fieldPath = match[2]; // 可能是 "formData.预算（元）" 或 "response.jurisdiction"
                    const fullRef = `${nodeName}.${fieldPath}`;

                    // 检查是否有匹配的上游变量
                    let isSatisfied = upstreamFullNames.has(fullRef) ||
                        upstreamVariables.some(v => v.nodeLabel === nodeName && v.field === fieldPath);

                    // 支持嵌套 JSON 字段引用：如果是 response.xxx 格式，检查上游是否有 response 字段
                    // 这允许在节点未执行时，{{Node.response.field}} 不显示为未匹配
                    if (!isSatisfied && fieldPath.includes('.')) {
                        const [baseField] = fieldPath.split('.');
                        isSatisfied = upstreamVariables.some(v =>
                            v.nodeLabel === nodeName && v.field === baseField
                        );
                    }

                    refs.push({
                        field: fullRef,
                        description: "条件表达式中引用",
                        isSatisfied,
                    });
                }
            }
        }

        // RAG 节点：检测 inputMappings 和 retrievalVariable 中的变量引用
        if (nodeType === 'rag') {
            const inputMappings = nodeData?.inputMappings as Record<string, string> | undefined;
            if (inputMappings?.query) {
                const vars = extractVariablesFromText(inputMappings.query);
                vars.forEach(varName => {
                    const isSatisfied = upstreamFieldNames.has(varName) ||
                        upstreamFullNames.has(varName) ||
                        varName.includes('.');
                    refs.push({
                        field: varName,
                        description: "查询内容中引用",
                        isSatisfied,
                    });
                });
            }

            // 检查新的 retrievalVariable 字段
            const retrievalVars = [
                { val: nodeData?.retrievalVariable as string, label: "知识源 1" },
                { val: nodeData?.retrievalVariable2 as string, label: "知识源 2" },
                { val: nodeData?.retrievalVariable3 as string, label: "知识源 3" }
            ];

            retrievalVars.forEach(({ val, label }) => {
                if (val) {
                    const vars = extractVariablesFromText(val);
                    vars.forEach(varName => {
                        const isSatisfied = upstreamFieldNames.has(varName) ||
                            upstreamFullNames.has(varName) ||
                            varName.includes('.');
                        refs.push({
                            field: varName,
                            description: `${label}中引用`,
                            isSatisfied,
                        });
                    });
                }
            });
        }

        // ImageGen 节点：检测 prompt 和 negativePrompt 中的变量引用
        if (nodeType === 'imagegen') {
            const prompt = nodeData?.prompt as string | undefined;
            if (prompt) {
                const vars = extractVariablesFromText(prompt);
                vars.forEach(varName => {
                    const isSatisfied = upstreamFieldNames.has(varName) ||
                        upstreamFullNames.has(varName) ||
                        varName.includes('.');
                    refs.push({
                        field: varName,
                        description: "图片描述中引用",
                        isSatisfied,
                    });
                });
            }
            const negativePrompt = nodeData?.negativePrompt as string | undefined;
            if (negativePrompt) {
                const vars = extractVariablesFromText(negativePrompt);
                vars.forEach(varName => {
                    const isSatisfied = upstreamFieldNames.has(varName) ||
                        upstreamFullNames.has(varName) ||
                        varName.includes('.');
                    refs.push({
                        field: varName,
                        description: "负向提示词中引用",
                        isSatisfied,
                    });
                });
            }
        }

        // Output 节点：检测 sources 和 template 中的变量引用（根据当前模式）
        if (nodeType === 'output') {
            const inputMappings = nodeData?.inputMappings as {
                mode?: string;
                sources?: Array<{ type: string; value: string }>;
                template?: string;
                attachments?: Array<{ type: string; value: string }>;
            } | undefined;

            const mode = inputMappings?.mode || 'direct';

            // 只有 template 模式才检查 template 字段
            if (mode === 'template' && inputMappings?.template) {
                const vars = extractVariablesFromText(inputMappings.template);
                vars.forEach(varName => {
                    const isSatisfied = upstreamFieldNames.has(varName) ||
                        upstreamFullNames.has(varName) ||
                        varName.includes('.');
                    refs.push({
                        field: varName,
                        description: "模板中引用",
                        isSatisfied,
                    });
                });
            }

            // direct, select, merge 模式才检查 sources 字段
            if (mode !== 'template' && inputMappings?.sources) {
                inputMappings.sources.forEach((source, idx) => {
                    if (source.type === 'variable' && source.value) {
                        const vars = extractVariablesFromText(source.value);
                        vars.forEach(varName => {
                            const isSatisfied = upstreamFieldNames.has(varName) ||
                                upstreamFullNames.has(varName) ||
                                varName.includes('.');
                            refs.push({
                                field: varName,
                                description: `输出来源 ${idx + 1} 中引用`,
                                isSatisfied,
                            });
                        });
                    }
                });
            }

            // attachments 独立于 mode，始终检查
            if (inputMappings?.attachments) {
                inputMappings.attachments.forEach((attachment, idx) => {
                    if (attachment.type === 'variable' && attachment.value) {
                        const vars = extractVariablesFromText(attachment.value);
                        vars.forEach(varName => {
                            const isSatisfied = upstreamFieldNames.has(varName) ||
                                upstreamFullNames.has(varName) ||
                                varName.includes('.');
                            refs.push({
                                field: varName,
                                description: `附件 ${idx + 1} 中引用`,
                                isSatisfied,
                            });
                        });
                    }
                });
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
