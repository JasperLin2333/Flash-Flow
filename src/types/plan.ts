import type { NodeKind, AppNodeData } from "@/types/flow";

// LLM 返回的计划数据类型
export type PlanNodeData = Partial<AppNodeData> & {
    label?: string;
    text?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    files?: Array<string | { name: string; size?: number; type?: string; url?: string }>;
    method?: string;
    url?: string;
    // Input node configs
    enableTextInput?: boolean;
    textRequired?: boolean;
    enableFileInput?: boolean;
    enableStructuredForm?: boolean;
    fileRequired?: boolean;
    fileConfig?: {
        allowedTypes?: string[];
        maxSizeMB?: number;
        maxCount?: number;
    };
    formFields?: Array<{ id: string; type: string; label: string; required?: boolean; defaultValue?: string; options?: string[] }>;
    // LLM node configs
    enableMemory?: boolean;
    memoryMaxTurns?: number;
    // Branch node configs
    condition?: string;
    // Tool node configs
    toolType?: string;
    inputs?: Record<string, unknown>;
    // RAG node configs
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
};

export type PlanNode = {
    id?: string;
    type?: NodeKind | string;
    position?: { x: number; y: number };
    data?: PlanNodeData;
    label?: string;
    // 支持直接属性（如果 AI 返回的结构没有用 data 包裹）
    text?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    files?: Array<string | { name: string; size?: number; type?: string; url?: string }>;
    method?: string;
    url?: string;
    // Direct properties for input node
    enableTextInput?: boolean;
    textRequired?: boolean;
    enableFileInput?: boolean;
    enableStructuredForm?: boolean;
    fileRequired?: boolean;
    fileConfig?: PlanNodeData['fileConfig'];
    formFields?: PlanNodeData['formFields'];
    // Direct properties for LLM node
    enableMemory?: boolean;
    memoryMaxTurns?: number;
    // Direct properties for Branch node
    condition?: string;
    // Direct properties for Tool node
    toolType?: string;
    inputs?: Record<string, unknown>;
    // Direct properties for RAG node
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
};

export type PlanEdge = {
    id?: string;
    source?: string;
    target?: string;
    sourceId?: string;
    targetId?: string;
    sourceLabel?: string;
    targetLabel?: string;
    label?: string;
    sourceHandle?: string; // For branch nodes: "true" or "false"
};

export type Plan = {
    title?: string;
    nodes?: PlanNode[];
    edges?: PlanEdge[]
};
