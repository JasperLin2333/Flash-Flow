"use client";
import { supabase } from "@/lib/supabase";

export interface ChatHistory {
    id: string;
    flow_id: string;
    user_message: string;
    assistant_message: string | null;
    created_at: string;
    updated_at: string;
}

export const chatHistoryAPI = {
    /**
     * 获取指定 flow 的聊天历史
     */
    async getHistory(flowId: string): Promise<ChatHistory[]> {
        const { data, error } = await supabase
            .from("chat_history")
            .select("*")
            .eq("flow_id", flowId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching chat history:", error);
            return [];
        }

        return (data || []) as ChatHistory[];
    },

    /**
     * 添加新的聊天记录
     */
    async addMessage(
        flowId: string,
        userMessage: string,
        assistantMessage: string | null = null
    ): Promise<ChatHistory | null> {
        const { data, error } = await supabase
            .from("chat_history")
            .insert({
                flow_id: flowId,
                user_message: userMessage,
                assistant_message: assistantMessage,
            })
            .select()
            .single();

        if (error) {
            console.error("Error adding chat message:", error);
            return null;
        }

        return data as ChatHistory;
    },

    /**
     * 更新聊天记录的 assistant 回复
     */
    async updateAssistantMessage(
        id: string,
        assistantMessage: string
    ): Promise<boolean> {
        const { error } = await supabase
            .from("chat_history")
            .update({ assistant_message: assistantMessage, updated_at: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            console.error("Error updating chat message:", error);
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
            console.error("Error clearing chat history:", error);
            return false;
        }

        return true;
    },
};
