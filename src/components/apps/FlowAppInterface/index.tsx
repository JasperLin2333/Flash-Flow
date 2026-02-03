import { useState, memo } from "react";
import PromptBubble from "@/components/ui/prompt-bubble";
import { useFlowStore } from "@/store/flowStore";
import type { InputNodeData } from "@/types/flow";
import { Header } from "./Header";
import { ChatArea } from "./ChatArea";
import { LAYOUT, UI_TEXT, type FlowAppInterfaceProps, type Message } from "./constants";

// Re-export types for external use
export type { Message, FlowAppInterfaceProps };

/**
 * FlowAppInterface - 主应用界面
 * 提供完整的聊天交互体验
 */
export default memo(function FlowAppInterface({
    flowTitle,
    flowIcon,
    messages,
    isLoading,
    isStreaming,
    streamingText,
    streamingReasoning,
    isStreamingReasoning,
    input,
    onInputChange,
    onSend,
    onClose,
    onGoHome,
    onNewConversation,
    sidebarOffset = 0,
}: FlowAppInterfaceProps) {
    const nodes = useFlowStore((s) => s.nodes);
    const updateNodeData = useFlowStore((s) => s.updateNodeData);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    // Find Input node to get configuration
    const inputNode = nodes.find(n => n.type === "input");
    const inputNodeData = inputNode?.data as InputNodeData | undefined;

    // Handle central form send (with formData)
    const handleCentralFormSend = (data: { text: string; files?: File[]; formData?: Record<string, unknown> }) => {
        const enableTextInput = inputNodeData?.enableTextInput !== false;
        if (inputNode) {
            updateNodeData(inputNode.id, {
                text: data.text,
                formData: data.formData,
            });
        }
        if (enableTextInput && data.text.trim().length > 0) {
            onInputChange(data.text);
        } else {
            onInputChange("");
        }

        onSend(data.files);
    };

    // Handle send with files and form data
    const handleSend = () => {
        if (inputNode) {
            // Update Input node with files and form data before sending
            updateNodeData(inputNode.id, {
                text: input,
                // In a real implementation, we would upload files here and pass URLs
            });
        }

        onSend(selectedFiles);
        setSelectedFiles([]);
    };

    // Handle file selection (append)
    const handleFileSelect = (newFiles: File[]) => {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
    };

    // Handle file removal
    const handleFileRemove = (fileToRemove: File) => {
        setSelectedFiles((prev) => prev.filter((f) => f !== fileToRemove));
    };

    // Determine if we are in the "Central Form" state
    const isCentralFormActive = messages.length === 0 && inputNodeData?.enableStructuredForm;

    return (
        <div className="flex flex-col flex-1 w-full h-full bg-white">
            <Header flowTitle={flowTitle} flowIcon={flowIcon} onClose={onClose} onGoHome={onGoHome} onNewConversation={onNewConversation} />
            <div
                className="flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-out"
                style={{ marginLeft: sidebarOffset }}
            >
                <ChatArea
                    messages={messages}
                    isLoading={isLoading}
                    isStreaming={isStreaming}
                    streamingText={streamingText}
                    streamingReasoning={streamingReasoning}
                    isStreamingReasoning={isStreamingReasoning}
                    flowIcon={flowIcon}
                    inputNodeData={inputNodeData}
                    flowTitle={flowTitle}
                    onSend={handleCentralFormSend}
                    onFormDataChange={(formData) => {
                        if (inputNode) {
                            updateNodeData(inputNode.id, { formData });
                        }
                    }}
                />

                {/* Only show bottom input bar if NOT in central form mode */}
                {!isCentralFormActive && (
                    <div className={`${LAYOUT.spacing.input} bg-gray-50 relative`}>
                        {/* Gradient mask for smooth content scrolling */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 to-transparent -translate-y-full pointer-events-none z-10" />

                        <div className={`${LAYOUT.inputMaxWidth} mx-auto`}>
                            <PromptBubble
                                value={input}
                                onChange={onInputChange}
                                onSubmit={handleSend}
                                placeholder={UI_TEXT.inputPlaceholder}
                                disabled={isLoading}
                                minRows={1}
                                inputNodeData={inputNodeData}
                                selectedFiles={selectedFiles}
                                onFileSelect={handleFileSelect}
                                onFileRemove={handleFileRemove}
                                onFormDataChange={(formData) => {
                                    // 实时同步表单数据到 Input 节点
                                    if (inputNode) {
                                        updateNodeData(inputNode.id, { formData });
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
