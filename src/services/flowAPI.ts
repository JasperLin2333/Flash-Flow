"use client";
import { supabase } from "@/lib/supabase";
import { authService } from "@/services/authService";
import type { FlowRecord, FlowData } from "@/types/flow";

// Supabase 行类型定义
type SupabaseFlowRow = {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    icon_kind: string | null;
    icon_name: string | null;
    icon_url: string | null;
    node_count: number | null;
    data: unknown;
    created_at: string;
    updated_at: string;
};

/**
 * 将 Supabase 行数据映射为 FlowRecord
 * 包含运行时验证和降级处理
 */
function mapRowToFlowRecord(row: SupabaseFlowRow): FlowRecord {
    // 验证和解析 FlowData
    let flowData: FlowData;
    try {
        const rawData = row.data;
        if (typeof rawData === 'object' && rawData !== null) {
            flowData = rawData as FlowData;
            // 验证必需字段
            if (!Array.isArray(flowData.nodes)) flowData.nodes = [];
            if (!Array.isArray(flowData.edges)) flowData.edges = [];
        } else {
            console.error('[flowAPI] Invalid flow data structure for flow:', row.id);
            flowData = { nodes: [], edges: [] };
        }
    } catch (e) {
        console.error('[flowAPI] Failed to parse flow data:', e);
        flowData = { nodes: [], edges: [] };
    }

    return {
        id: row.id,
        owner_id: row.owner_id,
        name: row.name || '未命名工作流',
        description: row.description ?? undefined,
        icon_kind: (row.icon_kind as FlowRecord['icon_kind']) ?? undefined,
        icon_name: row.icon_name ?? undefined,
        icon_url: row.icon_url ?? undefined,
        node_count: row.node_count ?? flowData.nodes.length,
        data: flowData,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/**
 * Flow API Service
 * Handles all database operations for flows
 */

export const flowAPI = {
    /**
     * Get current user ID or throw error if not authenticated
     */
    async getCurrentUserId(): Promise<string> {
        const user = await authService.getCurrentUser();
        if (!user) {
            throw new Error("用户未登录，请先登录");
        }
        return user.id;
    },

    /**
     * Get all flows for current user
     */
    async listFlows(ownerId?: string): Promise<FlowRecord[]> {
        // If no ownerId provided, use current user
        const userId = ownerId || await this.getCurrentUserId();

        const { data, error } = await supabase
            .from('flows')
            .select('*')
            .eq('owner_id', userId)
            .order('updated_at', { ascending: false });
        if (error) throw error;

        return ((data || []) as SupabaseFlowRow[]).map(mapRowToFlowRecord);
    },

    /**
     * Get a single flow by ID
     */
    async getFlow(id: string): Promise<FlowRecord | null> {
        const { data, error } = await supabase
            .from("flows")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            console.error("Error fetching flow:", error);
            return null;
        }

        if (!data) return null;

        return mapRowToFlowRecord(data as SupabaseFlowRow);
    },

    /**
     * Create a new flow
     */
    async createFlow(
        name: string,
        flowData: FlowData,
        ownerId?: string,
        description?: string
    ): Promise<FlowRecord> {
        // Use provided ownerId or get current user's ID
        const userId = ownerId || await this.getCurrentUserId();

        const { data, error } = await supabase
            .from("flows")
            .insert({
                owner_id: userId,
                name,
                description: description || null,
                data: flowData as any, // Cast to satisfy Json type
                node_count: (flowData?.nodes || []).length,
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating flow:", error);
            throw new Error(`Failed to create flow: ${error.message}`);
        }

        return mapRowToFlowRecord(data as SupabaseFlowRow);
    },

    /**
     * Update an existing flow
     */
    async updateFlow(
        id: string,
        updates: {
            name?: string;
            description?: string;
            data?: FlowData;
            // FIX: Allow null to properly clear icon fields
            icon_kind?: string | null;
            icon_name?: string | null;
            icon_url?: string | null;
        }
    ): Promise<FlowRecord> {
        const updateData: any = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.description !== undefined) updateData.description = updates.description ?? null;
        if (updates.data) updateData.data = updates.data;
        if (updates.data) updateData.node_count = (updates.data?.nodes || []).length;
        if (updates.icon_kind !== undefined) updateData.icon_kind = updates.icon_kind ?? null;
        if (updates.icon_name !== undefined) updateData.icon_name = updates.icon_name ?? null;
        if (updates.icon_url !== undefined) updateData.icon_url = updates.icon_url ?? null;

        const { data, error } = await supabase
            .from("flows")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("Error updating flow:", error);
            throw new Error(`Failed to update flow: ${error.message}`);
        }

        return mapRowToFlowRecord(data as SupabaseFlowRow);
    },

    /**
     * Delete a flow
     */
    async deleteFlow(id: string): Promise<void> {
        const { error } = await supabase.from("flows").delete().eq("id", id);

        if (error) {
            console.error("Error deleting flow:", error);
            throw new Error(`Failed to delete flow: ${error.message}`);
        }
    },

    /**
     * Auto-save current flow state (debounced in caller)
     */
    async autoSave(
        flowId: string | null,
        name: string,
        flowData: FlowData
    ): Promise<string> {
        if (flowId) {
            // Update existing flow
            await this.updateFlow(flowId, { name, data: flowData });
            return flowId;
        } else {
            // Create new flow
            const newFlow = await this.createFlow(name, flowData);
            return newFlow.id;
        }
    },

    async duplicateFlow(id: string): Promise<FlowRecord> {
        const existing = await this.getFlow(id);
        if (!existing) throw new Error("Flow not found");
        const copyName = `${existing.name} Copy`;
        const newFlow = await this.createFlow(copyName, existing.data, existing.owner_id, existing.description);
        // Update icon fields and return the result directly (no need for extra getFlow call)
        const updatedFlow = await this.updateFlow(newFlow.id, {
            icon_kind: existing.icon_kind,
            icon_name: existing.icon_name,
            icon_url: existing.icon_url,
        });
        return updatedFlow;
    },
};
