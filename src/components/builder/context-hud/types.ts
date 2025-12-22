import type { AppNode, AppEdge, NodeKind, OutputInputMappings } from "@/types/flow";

// ============ 上游变量类型 ============
export interface UpstreamVariable {
    nodeLabel: string;
    nodeId: string;
    field: string;
    value?: string;
}

// ============ 上游输入状态类型 ============
export interface UpstreamInputState {
    field: string;
    description: string;
    required: boolean;
    isSatisfied: boolean;
    configuredValue?: string;
    isToolInput?: boolean;
    hasInvalidVars?: boolean;
}

// ============ 引用变量类型 ============
export interface ReferencedVariable {
    field: string;
    description: string;
    isSatisfied: boolean;
}

// ============ 工具输入输出定义类型 ============
export type ToolInputFieldType = 'text' | 'number' | 'enum';

export interface ToolInputField {
    field: string;
    description: string;
    required: boolean;
    type?: ToolInputFieldType; // 字段类型，默认为 text
    enumOptions?: string[]; // 当 type 为 enum 时的选项列表
    dependsOn?: { field: string; value: string | string[] }; // 条件显示：依赖某个字段的值
}

export interface ToolIODefinition {
    inputs: ToolInputField[];
    outputs: { field: string; description: string }[];
}

// ============ NodeIOSection Props ============
export interface NodeIOSectionProps {
    nodeId: string;
    nodeType: NodeKind;
    nodeLabel?: string;
    nodeData?: Record<string, unknown>;
    nodes: AppNode[];
    edges: AppEdge[];
    flowContext: Record<string, unknown>;
    customOutputs?: { name: string; value: string }[];
    onUpdateCustomOutputs: (outputs: { name: string; value: string }[]) => void;
    onUpdateToolInputs?: (inputs: Record<string, unknown>) => void;
    onUpdateInputMappings?: (mappings: Record<string, string> | OutputInputMappings) => void;
}

// ============ 自定义输出类型 ============
export interface CustomOutput {
    name: string;
    value: string;
}
