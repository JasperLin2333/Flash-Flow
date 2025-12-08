/**
 * 修改指令执行器服务
 * 负责处理 AI 生成的流程修改指令
 * 包括节点的添加、删除、更新操作
 */

import type { AppNode, AppEdge } from "@/types/flow";
import { executeModificationAdd } from "./modification/add";
import { executeModificationDelete } from "./modification/delete";
import { executeModificationUpdate } from "./modification/update";
import { executeModificationReorder } from "./modification/reorder";
import type { ModificationInstruction } from "./modification/types";

// Re-export type for consumers
export type { ModificationInstruction };

// ============ 核心执行函数 ============

/**
 * 主路由函数：根据指令类型分发到对应的处理器
 * @param instruction - 修改指令
 * @param nodes - 当前画布节点
 * @param edges - 当前画布边
 * @param setNodes - 更新节点的回调
 * @param setEdges - 更新边的回调
 * @param updateNodeData - 更新节点数据的回调
 */
export function executeModification(
  instruction: ModificationInstruction,
  nodes: AppNode[],
  edges: AppEdge[],
  setNodes: (nodes: AppNode[]) => void,
  setEdges: (edges: AppEdge[]) => void,
  updateNodeData: (id: string, data: any) => void
): void {
  const { action } = instruction;

  switch (action) {
    case "add":
      executeModificationAdd(instruction, nodes, edges, setNodes, setEdges);
      break;
    case "delete":
      executeModificationDelete(instruction, nodes, edges, setNodes, setEdges);
      break;
    case "modify":
      executeModificationUpdate(instruction, nodes, updateNodeData);
      break;
    case "reorder":
      executeModificationReorder(instruction, nodes, edges, setNodes, setEdges);
      break;
    default:
      console.warn(`Unknown modification action: ${action}`);
  }
}

// Re-export specific executors if needed elsewhere (optional, maintaining backward compat if any)
export {
  executeModificationAdd,
  executeModificationDelete,
  executeModificationUpdate,
  executeModificationReorder
};
