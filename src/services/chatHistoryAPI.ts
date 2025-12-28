"use client";
import { supabase } from "@/lib/supabase";

export interface ChatHistory {
    id: string;
    flow_id: string;
    session_id: string | null;
    user_message: string;
    assistant_message: string | null;
    assistant_reasoning: string | null; // AI 思考过程
    token_usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
    user_attachments: any[] | null;
    assistant_attachments: any[] | null;
    created_at: string;
    updated_at: string;
}

export const chatHistoryAPI = {
    /**
     * 获取指定 flow 的所有聊天记录
     */
    async getHistory(flowId: string): Promise<ChatHistory[]> {
        const { data, error } = await supabase
            .from("chat_history")
            .select("*")
            .eq("flow_id", flowId)
            .order("created_at", { ascending: true });

        if (error) {
            return [];
        }

        return (data || []) as unknown as ChatHistory[];
    },

    /**
     * 获取指定 session 的聊天记录
     */
    async getSessionMessages(sessionId: string): Promise<ChatHistory[]> {
        const { data, error } = await supabase
            .from("chat_history")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });

        if (error) {
            return [];
        }

        return (data || []) as unknown as ChatHistory[];
    },

    /**
     * 获取单条消息 (Legacy Support)
     */
    async getMessageById(id: string): Promise<ChatHistory | null> {
        const { data, error } = await supabase
            .from("chat_history")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            // It's okay if not found
            return null;
        }
        return data as unknown as ChatHistory;
    },

    /**
     * 添加新的聊天记录
     */
    async addMessage(
        flowId: string,
        userMessage: string,
        sessionId: string,
        assistantMessage: string | null = null,
        userAttachments: any[] | null = null
    ): Promise<ChatHistory | null> {
        const { data, error } = await supabase
            .from("chat_history")
            .insert({
                flow_id: flowId,
                session_id: sessionId,
                user_message: userMessage,
                assistant_message: assistantMessage,
                user_attachments: userAttachments,
            })
            .select()
            .single();

        if (error) {
            return null;
        }

        return data as unknown as ChatHistory;
    },

    /**
     * 更新聊天记录的 assistant 回复
     */
    async updateAssistantMessage(
        id: string,
        assistantMessage: string,
        assistantAttachments: any[] | null = null,
        assistantReasoning: string | null = null,
        tokenUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null
    ): Promise<boolean> {
        const updateData: Record<string, any> = {
            assistant_message: assistantMessage,
            assistant_attachments: assistantAttachments,
            updated_at: new Date().toISOString()
        };

        // 仅在有值时添加，避免覆盖已有数据
        if (assistantReasoning) {
            updateData.assistant_reasoning = assistantReasoning;
        }
        if (tokenUsage) {
            updateData.token_usage = tokenUsage;
        }

        const { error } = await supabase
            .from("chat_history")
            .update(updateData)
            .eq("id", id);

        if (error) {
            return false;
        }

        return true;
    },

    /**
     * 删除指定 flow 的所有聊天历史
     */
    async clearHistory(flowId: string): Promise<boolean> {
        const { error } = await supabase
            .from("chat_history")
            .delete()
            .eq("flow_id", flowId);

        if (error) {
            return false;
        }

        return true;
    },
};
