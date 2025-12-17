export interface ChatAttachment {
    name: string;
    url: string;
    type?: string;
    size?: number;
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    id?: string; // Optional ID for persistence tracking
    files?: File[];
    attachments?: ChatAttachment[];
    timestamp?: Date;
}

export interface ChatSession {
    sessionId: string;
    messages: ChatMessage[];
    isExecuting: boolean;
}
