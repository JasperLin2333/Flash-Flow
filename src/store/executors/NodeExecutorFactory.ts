import type { NodeKind } from "@/types/flow";
import type { NodeExecutor } from "./BaseNodeExecutor";
import { InputNodeExecutor } from "./InputNodeExecutor";
import { LLMNodeExecutor } from "./LLMNodeExecutor";
import { RAGNodeExecutor } from "./RAGNodeExecutor";
import { HTTPNodeExecutor } from "./HTTPNodeExecutor";
import { OutputNodeExecutor } from "./OutputNodeExecutor";
import { BranchNodeExecutor } from "./BranchNodeExecutor";

export class NodeExecutorFactory {
  private static executors: Record<NodeKind, NodeExecutor> = {
    input: new InputNodeExecutor(),
    llm: new LLMNodeExecutor(),
    rag: new RAGNodeExecutor(),
    http: new HTTPNodeExecutor(),
    output: new OutputNodeExecutor(),
    branch: new BranchNodeExecutor(),
  };

  static getExecutor(nodeType: NodeKind): NodeExecutor {
    const executor = this.executors[nodeType];
    if (!executor) {
      throw new Error(`No executor found for node type: ${nodeType}`);
    }
    return executor;
  }
}
