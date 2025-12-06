/**
 * 修改指令执行器服务
 * 负责处理 AI 生成的流程修改指令
 * 包括节点的添加、删除、更新操作
 */

import { nanoid } from "nanoid";
import type { AppNode, AppEdge, NodeKind } from "@/types/flow";

// ============ 常量 ============
const DEFAULT_NODE_POSITION = { x: 320, y: 240 };
const POSITION_OFFSET = 300; // 节点间距

// ============ 类型定义 ============
interface ModificationInstruction {
  action: "add" | "delete" | "modify" | "reorder";
  target?: string;    // The EXACT Node ID targeted
  position?: "before" | "after"; // For 'add' or 'reorder'
  nodeType?: NodeKind; // For 'add'

  // For 'add': Full node config
  // For 'modify': Only fields to update
  nodeData?: Record<string, any>;

  // For 'reorder': The reference node ID to move relative to
  referenceNode?: string;

  // 🆕 批量操作支持（添加分支时需要）
  additionalNodes?: Array<{
    nodeType: string;
    nodeData: any;
    connectFrom?: string;
  }>;
  additionalEdges?: Array<{
    source: string;
    target: string;
    sourceHandle?: "true" | "false";
  }>;

  // Deprecated: 保留向后兼容性
  changes?: Record<string, any>;
}

// ============ 核心执行函数 ============

/**
 * 执行添加节点的修改指令
 * 支持单个节点和批量添加（分支场景）
 */
export function executeModificationAdd(
  instruction: ModificationInstruction,
  nodes: AppNode[],
  edges: AppEdge[],
  setNodes: (nodes: AppNode[]) => void,
  setEdges: (edges: AppEdge[]) => void
): void {
  const { target, nodeType, nodeData, position, additionalNodes, additionalEdges } = instruction;

  if (!nodeType) return;

  // 查找目标节点
  const targetNode = nodes.find(
    (n: AppNode) => n.id === target || n.data.label === target
  );

  // 生成新节点 ID 和位置
  const newId = `${nodeType}-${nanoid(8)}`;
  const newPos = targetNode
    ? {
      x: targetNode.position.x + (position === "after" ? POSITION_OFFSET : -POSITION_OFFSET),
      y: targetNode.position.y,
    }
    : DEFAULT_NODE_POSITION;

  // 创建新节点
  const newNode: AppNode = {
    id: newId,
    type: nodeType,
    position: newPos,
    data: {
      label: nodeType.toUpperCase(),
      status: "idle",
      ...nodeData,
    },
  };

  // 收集所有新节点
  let allNewNodes: AppNode[] = [newNode];
  const idMapping: Record<string, string> = {};
  idMapping[nodeType] = newId;
  idMapping["branch"] = newId; // 快捷引用

  // 🆕 处理 additionalNodes
  if (additionalNodes && additionalNodes.length > 0) {
    let offsetY = 0;
    additionalNodes.forEach((addNode, idx) => {
      const addId = `${addNode.nodeType}-${nanoid(8)}`;
      idMapping[addNode.nodeType + "_" + idx] = addId;
      idMapping[addNode.connectFrom || ""] = addId;

      // 分支场景：true 路径向上偏移，false 路径向下偏移
      offsetY = idx === 0 ? -100 : 100;

      const addNodeObj: AppNode = {
        id: addId,
        type: addNode.nodeType as NodeKind,
        position: {
          x: newPos.x + POSITION_OFFSET,
          y: newPos.y + offsetY,
        },
        data: {
          label: addNode.nodeType.toUpperCase(),
          status: "idle",
          ...addNode.nodeData,
        },
      };
      allNewNodes.push(addNodeObj);
    });
  }

  // 添加所有新节点
  setNodes([...nodes, ...allNewNodes]);

  // 处理边的连接逻辑
  let newEdges = [...edges];

  if (targetNode && position) {
    if (position === "after") {
      // 在目标节点之后插入：target -> new -> oldTarget
      // BUG FIX: Use targetNode.id instead of target (which may be a label, not ID)
      newEdges.push({
        id: `e-${targetNode.id}-${newId}`,
        source: targetNode.id,
        target: newId,
      } as AppEdge);

      // Find existing edge from target node to re-wire
      const oldEdge = edges.find((e: AppEdge) => e.source === targetNode.id);
      if (oldEdge) {
        // First remove the old edge to prevent duplicates
        newEdges = newEdges.filter((e: AppEdge) => e.id !== oldEdge.id);
        // Then add the new edge from new node to old target
        newEdges.push({
          id: `e-${newId}-${oldEdge.target}`,
          source: newId,
          target: oldEdge.target,
        } as AppEdge);
      }
    } else {
      // 在目标节点之前插入：oldSource -> new -> target
      const incomingEdge = edges.find((e: AppEdge) => e.target === target);
      if (incomingEdge) {
        newEdges.push({
          id: `e-${incomingEdge.source}-${newId}`,
          source: incomingEdge.source,
          target: newId,
        } as AppEdge);
        newEdges.push({
          id: `e-${newId}-${target}`,
          source: newId,
          target,
        } as AppEdge);
        newEdges = newEdges.filter((e: AppEdge) => e.id !== incomingEdge.id);
      }
    }
  } else {
    // 🆕 兜底：没有 target/position 时，尝试连接到 Output 节点
    const outputNode = nodes.find((n: AppNode) => n.type === "output");
    const lastLLM = nodes.filter((n: AppNode) => n.type === "llm").pop();

    if (lastLLM) {
      // 在最后一个 LLM 之后插入
      newEdges.push({
        id: `e-${lastLLM.id}-${newId}`,
        source: lastLLM.id,
        target: newId,
      } as AppEdge);

      if (outputNode) {
        // 重新连接到 Output
        newEdges = newEdges.filter((e: AppEdge) => !(e.source === lastLLM.id && e.target === outputNode.id));
        newEdges.push({
          id: `e-${newId}-${outputNode.id}`,
          source: newId,
          target: outputNode.id,
        } as AppEdge);
      }
    }
  }

  // 🆕 处理 additionalEdges
  if (additionalEdges && additionalEdges.length > 0) {
    additionalEdges.forEach((edge) => {
      // 解析 source/target（可能是占位符或真实 ID）
      let sourceId = edge.source;
      let targetId = edge.target;

      // 替换占位符
      if (sourceId === "branch" || sourceId === nodeType) sourceId = newId;
      if (targetId === "branch" || targetId === nodeType) targetId = newId;

      // 尝试从 idMapping 中查找
      if (idMapping[sourceId]) sourceId = idMapping[sourceId];
      if (idMapping[targetId]) targetId = idMapping[targetId];

      // 尝试从现有节点中查找
      const srcNode = nodes.find((n: AppNode) => n.id === sourceId || n.data.label === sourceId);
      const tgtNode = [...nodes, ...allNewNodes].find((n: AppNode) => n.id === targetId || n.data.label === targetId);

      if (srcNode) sourceId = srcNode.id;
      if (tgtNode) targetId = tgtNode.id;

      const newEdge: AppEdge = {
        id: `e-${sourceId}-${targetId}-${nanoid(4)}`,
        source: sourceId,
        target: targetId,
      };

      if (edge.sourceHandle) {
        newEdge.sourceHandle = edge.sourceHandle;
      }

      newEdges.push(newEdge);
    });
  }

  setEdges(newEdges);
}

/**
 * 执行删除节点的修改指令
 * @param instruction - 包含目标节点信息的指令
 * @param nodes - 当前画布上的所有节点
 * @param edges - 当前画布上的所有边
 * @param setNodes - 更新节点的回调函数
 * @param setEdges - 更新边的回调函数
 */
export function executeModificationDelete(
  instruction: ModificationInstruction,
  nodes: AppNode[],
  edges: AppEdge[],
  setNodes: (nodes: AppNode[]) => void,
  setEdges: (edges: AppEdge[]) => void
): void {
  const { target } = instruction;

  // 查找目标节点（支持 ID、ID 前缀、Label 匹配）
  const targetNode = nodes.find(
    (n: AppNode) =>
      n.id === target || n.id.includes(target || "") || n.data.label === target
  );

  if (targetNode) {
    // 删除节点及其关联的所有边
    setNodes(nodes.filter((n: AppNode) => n.id !== targetNode.id));
    setEdges(
      edges.filter(
        (e: AppEdge) =>
          e.source !== targetNode.id && e.target !== targetNode.id
      )
    );
  }
}

/**
 * 执行修改节点属性的指令
 * @param instruction - 包含目标节点和修改内容的指令
 * @param nodes - 当前画布上的所有节点
 * @param updateNodeData - 更新节点数据的回调函数
 */
export function executeModificationUpdate(
  instruction: ModificationInstruction,
  nodes: AppNode[],
  updateNodeData: (id: string, data: any) => void
): void {
  const { target, nodeData, changes } = instruction;

  // 查找目标节点
  const targetNode = nodes.find(
    (n: AppNode) =>
      n.id === target || n.id.includes(target || "") || n.data.label === target
  );

  if (targetNode) {
    // 优先使用 nodeData，向后兼容 changes
    const updateData = nodeData || changes;
    if (updateData) {
      updateNodeData(targetNode.id, updateData);
    }
  }
}

/**
 * 执行节点重排序的指令
 * @param instruction - 包含目标节点和参考节点的指令
 * @param nodes - 当前画布上的所有节点
 * @param edges - 当前画布上的所有边
 * @param setNodes - 更新节点的回调函数
 * @param setEdges - 更新边的回调函数
 */
export function executeModificationReorder(
  instruction: ModificationInstruction,
  nodes: AppNode[],
  edges: AppEdge[],
  setNodes: (nodes: AppNode[]) => void,
  setEdges: (edges: AppEdge[]) => void
): void {
  const { target, referenceNode, position } = instruction;

  // 查找目标节点和参考节点
  const targetNodeObj = nodes.find(
    (n: AppNode) => n.id === target || n.data.label === target
  );
  const refNodeObj = nodes.find(
    (n: AppNode) => n.id === referenceNode || n.data.label === referenceNode
  );

  if (!targetNodeObj || !refNodeObj) {
    console.warn("Reorder: target or reference node not found");
    return;
  }

  // 更新目标节点位置
  const updatedNodes = nodes.map((n: AppNode) => {
    if (n.id === targetNodeObj.id) {
      return {
        ...n,
        position: {
          x: refNodeObj.position.x + (position === "after" ? POSITION_OFFSET : -POSITION_OFFSET),
          y: refNodeObj.position.y,
        },
      };
    }
    return n;
  });

  setNodes(updatedNodes);

  // 重新连接边的逻辑（移除目标节点的原有连接，按新位置重建）
  const newEdges = edges.filter(
    (e: AppEdge) => e.source !== targetNodeObj.id && e.target !== targetNodeObj.id
  );

  if (position === "after") {
    // refNode -> target
    newEdges.push({
      id: `e-${refNodeObj.id}-${targetNodeObj.id}`,
      source: refNodeObj.id,
      target: targetNodeObj.id,
    } as AppEdge);

    // 找到原本 refNode 的下游节点，改为 target 连接
    const oldOutgoing = edges.find((e: AppEdge) => e.source === refNodeObj.id);
    if (oldOutgoing && oldOutgoing.target !== targetNodeObj.id) {
      newEdges.push({
        id: `e-${targetNodeObj.id}-${oldOutgoing.target}`,
        source: targetNodeObj.id,
        target: oldOutgoing.target,
      } as AppEdge);
      // 移除原 refNode 到下游的边
      const filteredEdges = newEdges.filter((e: AppEdge) => e.id !== oldOutgoing.id);
      setEdges(filteredEdges);
      return;
    }
  } else {
    // before: 上游 -> target -> refNode
    const incomingEdge = edges.find((e: AppEdge) => e.target === refNodeObj.id);
    if (incomingEdge) {
      newEdges.push({
        id: `e-${incomingEdge.source}-${targetNodeObj.id}`,
        source: incomingEdge.source,
        target: targetNodeObj.id,
      } as AppEdge);
    }
    newEdges.push({
      id: `e-${targetNodeObj.id}-${refNodeObj.id}`,
      source: targetNodeObj.id,
      target: refNodeObj.id,
    } as AppEdge);
  }

  setEdges(newEdges);
}

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
