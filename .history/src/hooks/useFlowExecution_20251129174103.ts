import { useState, useEffect, useRef, useCallback } from "react";
import { useFlowStore } from "@/store/flowStore";
import { chatHistoryAPI } from "@/services/chatHistoryAPI";
import { Message } from "./useChatSession";

// Constants for output extraction
const OUTPUT_FIELD_PRIORITY = ["text", "response", "query"] as const;
const MESSAGES = {
    ERROR_EXECUTION: "工作流执行失败，请稍后重试。",
    EMPTY_OUTPUT: "工作流已完成，但未生成输出。",
} as const;

interface UseFlowExecutionProps {
    flowId: string | null;
    currentChatId: string | null;
    onMessageReceived: (message: Message) => void;
    onExecutionComplete: () => void;
}

export function useFlowExecution({
    flowId,
    currentChatId,
    onMessageReceived,
    onExecutionComplete
}: UseFlowExecutionProps) {
    const [isExecuting, setIsExecuting] = useState(false);

    // Store selectors
    const runFlow = useFlowStore((s) => s.runFlow);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const nodes = useFlowStore((s) => s.nodes);
    const flowContext = useFlowStore((s) => s.flowContext);
    const executionStatus = useFlowStore((s) => s.executionStatus);

    // Track the chat ID that initiated the current execution
    const executionChatIdRef = useRef<string | null>(null);

    /**
     * Extract text from node output
     */
    const extractTextFromOutput = (data: Record<string, unknown> | undefined): string => {
        if (!data || typeof data !== 'object') return '';

        for (const field of OUTPUT_FIELD_PRIORITY) {
            const value = data[field];
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }

        return Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
    };

    /**
     * Find the final output from the flow
     */
    const extractFlowOutput = useCallback((): string => {
        // Priority 1: Output Node
        const outputNode = nodes.find(n => n.type === "output");
        if (outputNode) {
            const outData = flowContext[outputNode.id] as Record<string, unknown> | undefined;
            const text = extractTextFromOutput(outData);
            if (text) return text;
        }

        // Priority 2: Last executed node with output
        const lastNodeId = Object.keys(flowContext)
            .filter(id => flowContext[id])
            .pop();

        if (lastNodeId) {
            const outData = flowContext[lastNodeId] as Record<string, unknown> | undefined;
            const text = extractTextFromOutput(outData);
            if (text) return text;
        }

        return MESSAGES.EMPTY_OUTPUT;
    }, [nodes, flowContext]);

    /**
     * Execute the flow with user input
     */
    const executeFlow = useCallback(async (input: string, chatId: string) => {
        if (!flowId) return;

        try {
            setIsExecuting(true);
            executionChatIdRef.current = chatId;

            // Update Input Node
            const inputNode = nodes.find(n => n.type === "input");
            if (inputNode) {
                updateNodeData(inputNode.id, { text: input });
            }

            // Start Execution
            await runFlow();
        } catch (error) {
            console.error("[useFlowExecution] Failed to start flow:", error);
            setIsExecuting(false);
            executionChatIdRef.current = null;

            // Notify error immediately if start fails
            const errorMsg = MESSAGES.ERROR_EXECUTION;
            onMessageReceived({ role: "assistant", content: errorMsg });
            chatHistoryAPI.updateAssistantMessage(chatId, errorMsg);
        }
    }, [flowId, nodes, updateNodeData, runFlow, onMessageReceived]);

    /**
     * Monitor execution status
     */
    useEffect(() => {
        if (!isExecuting || !executionChatIdRef.current) return;

        // CRITICAL: Check if the user has switched chats. 
        // If currentChatId doesn't match the one that started execution, ignore the result.
        if (currentChatId !== executionChatIdRef.current) {
            console.warn(`[useFlowExecution] Chat switched during execution. Ignoring result for ${executionChatIdRef.current}`);
            // We don't stop execution (it's running in store), but we stop listening for this component
            return;
        }

        if (executionStatus === "completed") {
            console.log(`[useFlowExecution] Completed for chat: ${executionChatIdRef.current}`);

            const responseText = extractFlowOutput();
            onMessageReceived({ role: "assistant", content: responseText });

            // Persist to DB
            chatHistoryAPI.updateAssistantMessage(executionChatIdRef.current, responseText);

            setIsExecuting(false);
            executionChatIdRef.current = null;
            onExecutionComplete();

        } else if (executionStatus === "error") {
            console.log(`[useFlowExecution] Error for chat: ${executionChatIdRef.current}`);

            const errorMsg = MESSAGES.ERROR_EXECUTION;
            onMessageReceived({ role: "assistant", content: errorMsg });

            chatHistoryAPI.updateAssistantMessage(executionChatIdRef.current, errorMsg);

            setIsExecuting(false);
            executionChatIdRef.current = null;
            onExecutionComplete();
        }
    }, [executionStatus, isExecuting, currentChatId, extractFlowOutput, onMessageReceived, onExecutionComplete]);

    return {
        isExecuting,
        executeFlow
    };
}
