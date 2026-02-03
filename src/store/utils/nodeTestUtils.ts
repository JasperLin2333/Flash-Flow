import type { AppNode, AppEdge, LLMNodeData, RAGNodeData, ImageGenNodeData, FlowState } from "@/types/flow";
import { isToolNodeParametersConfigured } from "@/store/utils/debugDialogUtils";

export interface NodeTestContext {
    openDialog: FlowState['openDialog'];
    openInputPrompt: FlowState['openInputPrompt'];
    runNode: FlowState['runNode'];
}

/**
 * Handle node test logic - unified for both CustomNode and ContextHUD
 */
export function handleNodeTest(
    nodeId: string,
    node: AppNode,
    nodes: AppNode[],
    edges: AppEdge[],
    ctx: NodeTestContext
): void {
    const { type, data } = node;

    // Input 节点：用户需要填写测试数据（复用 InputPromptDialog）
    if (type === 'input') {
        ctx.openInputPrompt(nodeId);  // 传入 nodeId 表示单节点测试模式
        return;
    }

    // Output 节点：始终打开弹窗
    if (type === 'output') {
        ctx.openDialog('output', nodeId);
        return;
    }

    // LLM 节点：检查 inputMappings.user_input 是否已配置
    if (type === 'llm') {
        const llmData = data as LLMNodeData;
        const inputMappings = (llmData as unknown as { inputMappings?: Record<string, string> })?.inputMappings;
        const userInputValue = inputMappings?.user_input;

        // 如果已配置且不是变量引用（没有 {{），则直接运行
        if (userInputValue && userInputValue.trim() && !userInputValue.includes('{{')) {
            ctx.runNode(nodeId, { user_input: userInputValue });
            return;
        }

        // 否则打开调试弹窗让用户填写
        ctx.openDialog('llm', nodeId);
        return;
    }

    // RAG 节点：检查 inputMappings.query 是否已配置且有文件
    if (type === 'rag') {
        const ragData = data as RAGNodeData;
        const inputMappings = (ragData as unknown as { inputMappings?: Record<string, string> })?.inputMappings;
        const queryValue = inputMappings?.query;
        // Logic: 
        // 1. Must have at least one file uploaded (static context) OR be in variable mode (which needs dialog anyway, so logic holds).
        // 2. Must have a query provided.
        // 3. Query must be safe (no variables).

        // Check all file slots
        const hasStaticFiles = (ragData.files && ragData.files.length > 0) ||
            (ragData.files2 && ragData.files2.length > 0) ||
            (ragData.files3 && ragData.files3.length > 0);

        const hasFiles = hasStaticFiles; // For auto-run, we require static files. Variable mode usually requires input dialog.

        const hasQuery = !!(queryValue && queryValue.trim());
        const isQuerySafe = !hasQuery || !queryValue.includes('{{');

        if (hasFiles && hasQuery && isQuerySafe) {
            ctx.runNode(nodeId, { query: queryValue });
            return;
        }

        // Otherwise open debug dialog
        ctx.openDialog('rag', nodeId);
        return;
    }

    // Tool 节点：检查参数是否充分配置
    if (type === 'tool') {
        // 获取当前节点（从 store 中获取完整的节点对象）
        // Note: The passed `node` might be from a list, ensuring we use the one passed in
        if (isToolNodeParametersConfigured(node)) {
            // 如果参数充分配置，直接运行
            ctx.runNode(nodeId);
        } else {
            // 否则打开调试弹窗
            ctx.openDialog('tool', nodeId);
        }
        return;
    }

    // ImageGen 节点：如果已配置 prompt 且无变量，直接运行
    if (type === 'imagegen') {
        const imageGenData = data as ImageGenNodeData;
        const prompt = imageGenData?.prompt;

        if (prompt && prompt.trim() && !prompt.includes('{{')) {
            ctx.runNode(nodeId);
        } else {
            // 提示用户需要配置 prompt 或有变量需要填写
            ctx.openDialog('imagegen', nodeId);
        }
        return;
    }

    // Branch 节点：如果已配置 condition，直接运行；否则打开调试弹窗提示配置
    if (type === 'branch') {
        const branchData = data as import("@/types/flow").BranchNodeData;
        const condition = branchData?.condition;

        if (condition && condition.trim()) {
            // 有条件：直接运行
            ctx.runNode(nodeId);
        } else {
            // 无条件：打开调试弹窗提示配置条件
            ctx.openDialog('branch', nodeId);
        }
        return;
    }

    // Check upstream dependencies
    const incomingEdges = edges.filter(e => e.target === nodeId);
    if (incomingEdges.length === 0) {
        ctx.runNode(nodeId);
        return;
    }

    // For nodes with upstream dependencies, run directly
    // Upstream data will be available from flowContext
    ctx.runNode(nodeId);
}
