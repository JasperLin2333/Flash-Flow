import type { NodeKind } from "@/types/flow";
import type { NodeExecutor } from "./BaseNodeExecutor";
import { InputNodeExecutor } from "./InputNodeExecutor";
import { LLMNodeExecutor } from "./LLMNodeExecutor";
import { RAGNodeExecutor } from "./RAGNodeExecutor";
import { OutputNodeExecutor } from "./OutputNodeExecutor";
import { BranchNodeExecutor } from "./BranchNodeExecutor";
import { ToolNodeExecutor } from "./ToolNodeExecutor";

export class NodeExecutorFactory {
  private static executors: Record<NodeKind, NodeExecutor> = {
    input: new InputNodeExecutor(),
    llm: new LLMNodeExecutor(),
    rag: new RAGNodeExecutor(),
    output: new OutputNodeExecutor(),
    branch: new BranchNodeExecutor(),
    tool: new ToolNodeExecutor(),
  };

  static getExecutor(nodeType: NodeKind): NodeExecutor {
    const executor = this.executors[nodeType];
    if (!executor) {
      throw new Error(`No executor found for node type: ${nodeType}`);
    }
    return executor;
  }
}
