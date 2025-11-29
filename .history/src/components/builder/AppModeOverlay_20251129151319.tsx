"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/store/flowStore";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import FlowAppInterface from "@/components/apps/FlowAppInterface";

// ============ Constants ============
const ANIMATION = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
} as const;

const DEFAULT_ASSISTANT_MSG = "Flow completed without output.";
const ERROR_MSG = "Error executing flow.";

// ============ Utilities ============
/**
 * 提取执行结果文本
 * 优先查找 output 节点，然后 fallback 到最后一个节点
 */
function extractExecutionOutput(
    flowContext: Record<string, any>,
    nodes: Array<{ id: string; type: string }>
): string {
    const outputNode = nodes.find((n) => n.type === "output");
    if (outputNode) {
        const outData = flowContext[outputNode.id];
        return (outData as any)?.text || JSON.stringify(outData);
    }

    // Fallback: 查找最后一个节点
    const lastNodeId = Object.keys(flowContext).pop();
    if (lastNodeId) {
        const outData = flowContext[lastNodeId];
        return (
            (outData as any)?.response || (outData as any)?.text || JSON.stringify(outData)
        );
    }

    return DEFAULT_ASSISTANT_MSG;
}

export default function AppModeOverlay() {
    const isAppMode = useFlowStore((s) => s.isAppMode);
    const setAppMode = useFlowStore((s) => s.setAppMode);
    const runFlow = useFlowStore((s) => s.runFlow);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const nodes = useFlowStore((s) => s.nodes);
    const executionStatus = useFlowStore((s) => s.executionStatus);
    const flowContext = useFlowStore((s) => s.flowContext);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const flowIconKind = useFlowStore((s) => s.flowIconKind);
    const flowIconName = useFlowStore((s) => s.flowIconName);
    const flowIconUrl = useFlowStore((s) => s.flowIconUrl);

    const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 新建对话：重置对话状态
    const handleNewConversation = () => {
        setMessages([]);
        setInput("");
    };

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // \u5904\u7406\u6d41\u7a0b\u5b8c\u6210\u6216\u9519\u8bef
    useEffect(() => {
        if (executionStatus === "completed" && isLoading) {
            setIsLoading(false);
            const outputText = extractExecutionOutput(flowContext, nodes);
            setMessages((prev) => [...prev, { role: "assistant", content: outputText }]);
        } else if (executionStatus === "error" && isLoading) {
            setIsLoading(false);
            setMessages((prev) => [...prev, { role: "assistant", content: ERROR_MSG }]);
        }
    }, [executionStatus, flowContext, nodes, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
        setIsLoading(true);

        // 更新 Input Node并运行 Flow
        const inputNode = nodes.find((n) => n.type === "input");
        if (inputNode) {
            updateNodeData(inputNode.id, { text: userMsg });
        }
        await runFlow();
    };

    return (
        <AnimatePresence>
            {isAppMode && (
                <motion.div
                    initial={ANIMATION.initial}
                    animate={ANIMATION.animate}
                    exit={ANIMATION.exit}
                    className="fixed inset-0 z-50 bg-white flex flex-col"
                >
                    {/* 新建对话按钮 */}
                    <button
                        onClick={handleNewConversation}
                        className="group fixed top-20 left-8 z-50 rounded-full bg-black text-white hover:bg-black/90 active:bg-black/95 shadow-md transition-all duration-150 h-10 w-10 flex items-center justify-center"
                        aria-label="新建对话"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded-md px-2 py-1 shadow-md whitespace-nowrap font-medium transition-all duration-150">
                            新建对话
                        </span>
                    </button>
                    <FlowAppInterface
                        flowTitle={flowTitle}
                        flowIcon={{
                            kind: flowIconKind,
                            name: flowIconName,
                            url: flowIconUrl,
                        }}
                        messages={messages}
                        isLoading={isLoading}
                        input={input}
                        onInputChange={setInput}
                        onSend={handleSend}
                        onClose={() => setAppMode(false)}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
