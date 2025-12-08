export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    id?: string; // Optional ID for persistence tracking
}

export interface ChatSession {
    sessionId: string;
    messages: ChatMessage[];
    isExecuting: boolean;
}
