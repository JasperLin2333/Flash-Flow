export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            flows: {
                Row: {
                    id: string
                    owner_id: string
                    name: string
                    description: string | null
                    data: Json
                    // FIX: Added missing columns that application code expects
                    icon_kind: string | null
                    icon_name: string | null
                    icon_url: string | null
                    node_count: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    owner_id: string
                    name: string
                    description?: string | null
                    data: Json
                    // FIX: Added missing columns for insert operations
                    icon_kind?: string | null
                    icon_name?: string | null
                    icon_url?: string | null
                    node_count?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    owner_id?: string
                    name?: string
                    description?: string | null
                    data?: Json
                    // FIX: Added missing columns for update operations
                    icon_kind?: string | null
                    icon_name?: string | null
                    icon_url?: string | null
                    node_count?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            },
            chat_history: {
                Row: {
                    id: string
                    flow_id: string
                    user_message: string
                    assistant_message: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    flow_id: string
                    user_message: string
                    assistant_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    flow_id?: string
                    user_message?: string
                    assistant_message?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "chat_history_flow_id_fkey"
                        columns: ["flow_id"]
                        isOneToOne: false
                        referencedRelation: "flows"
                        referencedColumns: ["id"]
                    }
                ]
            },
            users_quota: {
                Row: {
                    id: string
                    user_id: string
                    llm_executions_used: number
                    flow_generations_used: number
                    app_usages_used: number
                    llm_executions_limit: number
                    flow_generations_limit: number
                    app_usages_limit: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    llm_executions_used?: number
                    flow_generations_used?: number
                    app_usages_used?: number
                    llm_executions_limit?: number
                    flow_generations_limit?: number
                    app_usages_limit?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    llm_executions_used?: number
                    flow_generations_used?: number
                    app_usages_used?: number
                    llm_executions_limit?: number
                    flow_generations_limit?: number
                    app_usages_limit?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "users_quota_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            },
            llm_node_memory: {
                Row: {
                    id: string
                    flow_id: string
                    node_id: string
                    session_id: string
                    role: string
                    content: string
                    turn_index: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    flow_id: string
                    node_id: string
                    session_id: string
                    role: string
                    content: string
                    turn_index: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    flow_id?: string
                    node_id?: string
                    session_id?: string
                    role?: string
                    content?: string
                    turn_index?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "llm_node_memory_flow_id_fkey"
                        columns: ["flow_id"]
                        isOneToOne: false
                        referencedRelation: "flows"
                        referencedColumns: ["id"]
                    }
                ]
            },
            file_uploads: {
                Row: {
                    id: string
                    node_id: string
                    flow_id: string | null
                    file_name: string
                    file_type: string
                    file_size: number
                    storage_path: string
                    storage_url: string
                    uploaded_by: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    node_id: string
                    flow_id?: string | null
                    file_name: string
                    file_type: string
                    file_size: number
                    storage_path: string
                    storage_url: string
                    uploaded_by?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    node_id?: string
                    flow_id?: string | null
                    file_name?: string
                    file_type?: string
                    file_size?: number
                    storage_path?: string
                    storage_url?: string
                    uploaded_by?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "file_uploads_flow_id_fkey"
                        columns: ["flow_id"]
                        isOneToOne: false
                        referencedRelation: "flows"
                        referencedColumns: ["id"]
                    }
                ]
            },
            llm_models: {
                Row: {
                    id: string
                    model_id: string
                    model_name: string
                    provider: string
                    is_active: boolean
                    display_order: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    model_id: string
                    model_name: string
                    provider: string
                    is_active?: boolean
                    display_order?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    model_id?: string
                    model_name?: string
                    provider?: string
                    is_active?: boolean
                    display_order?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            },
            knowledge_files: {
                Row: {
                    id: string
                    user_id: string
                    file_name: string
                    file_url: string
                    file_type: string | null
                    status: string
                    token_count: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    file_name: string
                    file_url: string
                    file_type?: string | null
                    status?: string
                    token_count?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    file_name?: string
                    file_url?: string
                    file_type?: string | null
                    status?: string
                    token_count?: number
                    created_at?: string
                }
                Relationships: []
            },
            flow_executions: {
                Row: {
                    id: string
                    flow_id: string
                    user_id: string
                    status: string
                    input_params: object
                    output_result: object
                    duration_ms: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    flow_id: string
                    user_id: string
                    status?: string
                    input_params?: object
                    output_result?: object
                    duration_ms?: number | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    flow_id?: string
                    user_id?: string
                    status?: string
                    input_params?: object
                    output_result?: object
                    duration_ms?: number | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "flow_executions_flow_id_fkey"
                        columns: ["flow_id"]
                        isOneToOne: false
                        referencedRelation: "flows"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
