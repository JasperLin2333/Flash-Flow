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
