import { supabase } from "@/lib/supabase";

/**
 * LLM 节点对话记忆服务
 * 管理 LLM 节点在 Flow 执行过程中的对话历史
 */

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

export const llmMemoryService = {
    /**
     * 获取节点的对话历史
     * @param flowId - Flow ID
     * @param nodeId - LLM Node ID
     * @param sessionId - 执行会话 ID
     * @param maxTurns - 最大返回轮数
     * @returns 对话消息数组（按时间正序）
     */
    async getHistory(
        flowId: string,
        nodeId: string,
        sessionId: string,
        maxTurns: number = 10
    ): Promise<ConversationMessage[]> {
        try {
            const { data, error } = await supabase
                .from("llm_node_memory")
                .select("role, content, turn_index")
                .eq("flow_id", flowId)
                .eq("node_id", nodeId)
                .eq("session_id", sessionId)
                .order("turn_index", { ascending: true })
                .limit(maxTurns * 2); // user + assistant per turn

            if (error) {
                console.error("[llmMemoryService] getHistory error:", error);
                return [];
            }

            return (data || []).map((record: { role: string; content: string }) => ({
                role: record.role as 'user' | 'assistant',
                content: record.content,
            }));
        } catch (e) {
            console.error("[llmMemoryService] getHistory exception:", e);
            return [];
        }
    },

    /**
     * 追加消息到历史
     * @param flowId - Flow ID
     * @param nodeId - LLM Node ID
     * @param sessionId - 执行会话 ID
     * @param role - 角色 (user/assistant)
     * @param content - 消息内容
     */
    async appendMessage(
        flowId: string,
        nodeId: string,
        sessionId: string,
        role: 'user' | 'assistant',
        content: string
    ): Promise<void> {
        try {
            // 获取当前最大 turn_index
            const { data: existing } = await supabase
                .from("llm_node_memory")
                .select("turn_index")
                .eq("flow_id", flowId)
                .eq("node_id", nodeId)
                .eq("session_id", sessionId)
                .order("turn_index", { ascending: false })
                .limit(1);

            const nextTurnIndex = existing && existing.length > 0
                ? (existing[0] as { turn_index: number }).turn_index + 1
                : 0;

            const { error } = await supabase
                .from("llm_node_memory")
                .insert({
                    flow_id: flowId,
                    node_id: nodeId,
                    session_id: sessionId,
                    role,
                    content,
                    turn_index: nextTurnIndex,
                });

            if (error) {
                console.error("[llmMemoryService] appendMessage error:", error);
            }
        } catch (e) {
            console.error("[llmMemoryService] appendMessage exception:", e);
        }
    },

    /**
     * 清空节点的历史
     * @param flowId - Flow ID
     * @param nodeId - LLM Node ID  
     * @param sessionId - 执行会话 ID（可选，如果不传则清空该节点所有会话的记忆）
     */
    async clearHistory(
        flowId: string,
        nodeId: string,
        sessionId?: string
    ): Promise<void> {
        try {
            let query = supabase
                .from("llm_node_memory")
                .delete()
                .eq("flow_id", flowId)
                .eq("node_id", nodeId);
            
            // 如果指定了 sessionId，则只清空该会话的记忆
            if (sessionId) {
                query = query.eq("session_id", sessionId);
            }

            const { error } = await query;

            if (error) {
                console.error("[llmMemoryService] clearHistory error:", error);
            }
        } catch (e) {
            console.error("[llmMemoryService] clearHistory exception:", e);
        }
    },

    /**
     * 修剪历史到指定轮数（删除最旧的消息）
     * @param flowId - Flow ID
     * @param nodeId - LLM Node ID
     * @param sessionId - 执行会话 ID
     * @param maxTurns - 保留的最大轮数
     */
    async trimHistory(
        flowId: string,
        nodeId: string,
        sessionId: string,
        maxTurns: number
    ): Promise<void> {
        try {
            // 获取当前记录数
            const { count } = await supabase
                .from("llm_node_memory")
                .select("*", { count: "exact", head: true })
                .eq("flow_id", flowId)
                .eq("node_id", nodeId)
                .eq("session_id", sessionId);

            const maxMessages = maxTurns * 2;
            if (count && count > maxMessages) {
                // 获取需要删除的记录 ID
                const { data: toDelete } = await supabase
                    .from("llm_node_memory")
                    .select("id")
                    .eq("flow_id", flowId)
                    .eq("node_id", nodeId)
                    .eq("session_id", sessionId)
                    .order("turn_index", { ascending: true })
                    .limit(count - maxMessages);

                if (toDelete && toDelete.length > 0) {
                    const idsToDelete = toDelete.map((r: { id: string }) => r.id);
                    await supabase
                        .from("llm_node_memory")
                        .delete()
                        .in("id", idsToDelete);
                }
            }
        } catch (e) {
            console.error("[llmMemoryService] trimHistory exception:", e);
        }
    },
};
