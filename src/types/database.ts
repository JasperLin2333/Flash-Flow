export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_history: {
        Row: {
          assistant_attachments: Json | null
          assistant_message: string | null
          created_at: string
          execution_started_at: string | null
          execution_status: string | null
          flow_id: string
          id: string
          session_id: string | null
          updated_at: string
          user_attachments: Json | null
          user_message: string
        }
        Insert: {
          assistant_attachments?: Json | null
          assistant_message?: string | null
          created_at?: string
          execution_started_at?: string | null
          execution_status?: string | null
          flow_id: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_attachments?: Json | null
          user_message: string
        }
        Update: {
          assistant_attachments?: Json | null
          assistant_message?: string | null
          created_at?: string
          execution_started_at?: string | null
          execution_status?: string | null
          flow_id?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_attachments?: Json | null
          user_message?: string
        }
        Relationships: []
      }
      file_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          flow_id: string | null
          id: string
          node_id: string
          storage_path: string
          storage_url: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          flow_id?: string | null
          id?: string
          node_id: string
          storage_path: string
          storage_url: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          flow_id?: string | null
          id?: string
          node_id?: string
          storage_path?: string
          storage_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_uploads_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_executions: {
        Row: {
          created_at: string
          duration_ms: number | null
          flow_id: string
          id: string
          input_params: Json | null
          output_result: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          flow_id: string
          id?: string
          input_params?: Json | null
          output_result?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          flow_id?: string
          id?: string
          input_params?: Json | null
          output_result?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          created_at: string
          data: Json
          description: string | null
          icon_kind: string | null
          icon_name: string | null
          icon_url: string | null
          id: string
          name: string
          node_count: number | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          description?: string | null
          icon_kind?: string | null
          icon_name?: string | null
          icon_url?: string | null
          id?: string
          name: string
          node_count?: number | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          description?: string | null
          icon_kind?: string | null
          icon_name?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          node_count?: number | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      image_gen_models: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          model_id: string
          model_name: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          model_id: string
          model_name: string
          provider?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          model_id?: string
          model_name?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_files: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          status: string | null
          token_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          status?: string | null
          token_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          status?: string | null
          token_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      llm_models: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          model_id: string
          model_name: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          model_id: string
          model_name: string
          provider: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          model_id?: string
          model_name?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      llm_node_memory: {
        Row: {
          content: string
          created_at: string
          flow_id: string
          id: string
          node_id: string
          role: string
          session_id: string
          turn_index: number
        }
        Insert: {
          content: string
          created_at?: string
          flow_id: string
          id?: string
          node_id: string
          role: string
          session_id: string
          turn_index: number
        }
        Update: {
          content?: string
          created_at?: string
          flow_id?: string
          id?: string
          node_id?: string
          role?: string
          session_id?: string
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "llm_node_memory_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_emoji: string | null
          avatar_kind: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_emoji?: string | null
          avatar_kind?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_emoji?: string | null
          avatar_kind?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users_quota: {
        Row: {
          app_usages_limit: number | null
          app_usages_used: number | null
          created_at: string | null
          flow_generations_limit: number | null
          flow_generations_used: number | null
          id: string
          image_gen_executions_limit: number | null
          image_gen_executions_used: number | null
          llm_executions_limit: number | null
          llm_executions_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_usages_limit?: number | null
          app_usages_used?: number | null
          created_at?: string | null
          flow_generations_limit?: number | null
          flow_generations_used?: number | null
          id?: string
          image_gen_executions_limit?: number | null
          image_gen_executions_used?: number | null
          llm_executions_limit?: number | null
          llm_executions_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_usages_limit?: number | null
          app_usages_used?: number | null
          created_at?: string | null
          flow_generations_limit?: number | null
          flow_generations_used?: number | null
          id?: string
          image_gen_executions_limit?: number | null
          image_gen_executions_used?: number | null
          llm_executions_limit?: number | null
          llm_executions_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_quota: {
        Args: { p_quota_type: string; p_user_id: string }
        Returns: boolean
      }
      get_quota_status: {
        Args: { p_quota_type: string; p_user_id: string }
        Returns: {
          allowed: boolean
          current_limit: number
          current_used: number
          remaining: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
