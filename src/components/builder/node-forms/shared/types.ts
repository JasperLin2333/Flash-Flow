"use client";

import type { UseFormReturn } from "react-hook-form";
import type { AppNode, AppNodeData } from "@/types/flow";

/**
 * 节点表单共享类型定义
 * 所有节点表单统一使用这些类型
 */

/**
 * 基础节点表单 Props
 * 适用于只需要 form 的简单节点（如 LLM、Tool、Branch、Output）
 */
export interface BaseNodeFormProps {
    /**
     * react-hook-form 表单实例
     * 使用 any 类型是因为父组件使用多态表单 schema，包含多种节点类型的字段
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: UseFormReturn<any>;
}

/**
 * 扩展节点表单 Props
 * 适用于需要直接更新节点数据的复杂节点（如 Input、RAG）
 */
export interface ExtendedNodeFormProps extends BaseNodeFormProps {
    /** 当前选中的节点 ID */
    selectedNodeId: string | null;
    /** 更新节点数据的回调函数 */
    updateNodeData: (id: string, data: Partial<AppNodeData>) => void;
    /** 当前选中的节点对象（可选） */
    selectedNode?: AppNode;
}
