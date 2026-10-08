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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          label: string | null
          last_used_at: string | null
          org_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          org_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          org_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          control_id: string | null
          created_at: string
          id: string
          message: string
          org_id: string
          resolved_at: string | null
          severity: string
        }
        Insert: {
          control_id?: string | null
          created_at?: string
          id?: string
          message: string
          org_id: string
          resolved_at?: string | null
          severity: string
        }
        Update: {
          control_id?: string | null
          created_at?: string
          id?: string
          message?: string
          org_id?: string
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          answered_at: string
          answered_by: string
          assessment_id: string
          question_id: string
          value: string
        }
        Insert: {
          answered_at?: string
          answered_by?: string
          assessment_id: string
          question_id: string
          value: string
        }
        Update: {
          answered_at?: string
          answered_by?: string
          assessment_id?: string
          question_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          catalog_version: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          external_score: number | null
          id: string
          kind: string
          org_id: string
          score: number | null
          seal: string
          status: string
        }
        Insert: {
          catalog_version?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_score?: number | null
          id?: string
          kind: string
          org_id: string
          score?: number | null
          seal?: string
          status?: string
        }
        Update: {
          catalog_version?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_score?: number | null
          id?: string
          kind?: string
          org_id?: string
          score?: number | null
          seal?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: number
          ip: unknown
          meta: Json
          org_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: never
          ip?: unknown
          meta?: Json
          org_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: never
          ip?: unknown
          meta?: Json
          org_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      authorizations: {
        Row: {
          accepted_at: string
          accepted_by: string
          doc_version: string
          id: string
          ip: unknown
          kind: string
          org_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_by: string
          doc_version: string
          id?: string
          ip?: unknown
          kind: string
          org_id: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string
          doc_version?: string
          id?: string
          ip?: unknown
          kind?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorizations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_results: {
        Row: {
          assessment_id: string
          control_id: string
          divergence: boolean
          evidence_sha256: string | null
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
        }
        Insert: {
          assessment_id: string
          control_id: string
          divergence?: boolean
          evidence_sha256?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: string
          status: string
        }
        Update: {
          assessment_id?: string
          control_id?: string
          divergence?: boolean
          evidence_sha256?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_results_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
        ]
      }
      controls: {
        Row: {
          area: string
          catalog_version: string
          id: string
          name: string
          weight: number
        }
        Insert: {
          area: string
          catalog_version: string
          id: string
          name: string
          weight: number
        }
        Update: {
          area?: string
          catalog_version?: string
          id?: string
          name?: string
          weight?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          kind: string
          org_id: string
          sha256: string
          storage_path: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id: string
          sha256: string
          storage_path: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          sha256?: string
          storage_path?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          description: string
          id: string
          opened_by: string
          org_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          opened_by?: string
          org_id: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          opened_by?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assessment_id: string | null
          attempts: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          org_id: string
          payload: Json
          started_at: string | null
          status: string
        }
        Insert: {
          assessment_id?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          org_id: string
          payload?: Json
          started_at?: string | null
          status?: string
        }
        Update: {
          assessment_id?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          org_id?: string
          payload?: Json
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string
          domain: string | null
          employees_range: string | null
          id: string
          name: string
          partner_id: string | null
          plan: string
          sector: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by: string
          domain?: string | null
          employees_range?: string | null
          id?: string
          name: string
          partner_id?: string | null
          plan?: string
          sector?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string
          domain?: string | null
          employees_range?: string | null
          id?: string
          name?: string
          partner_id?: string | null
          plan?: string
          sector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          kind: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          kind: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_staff: boolean
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_staff?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_staff?: boolean
        }
        Relationships: []
      }
      reports: {
        Row: {
          assessment_id: string | null
          created_at: string
          id: string
          kind: string
          org_id: string
          sha256: string
          storage_path: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id: string
          sha256: string
          storage_path: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          sha256?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_results: {
        Row: {
          assessment_id: string | null
          collected_at: string
          collector_version: string
          device_ref: string | null
          id: string
          module: string
          org_id: string
          received_at: string
          sha256: string
          summary: Json
        }
        Insert: {
          assessment_id?: string | null
          collected_at: string
          collector_version: string
          device_ref?: string | null
          id?: string
          module: string
          org_id: string
          received_at?: string
          sha256: string
          summary: Json
        }
        Update: {
          assessment_id?: string | null
          collected_at?: string
          collector_version?: string
          device_ref?: string | null
          id?: string
          module?: string
          org_id?: string
          received_at?: string
          sha256?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scan_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_document: { Args: { p_document: string }; Returns: undefined }
      create_agent_token: {
        Args: { p_label: string; p_org: string }
        Returns: string
      }
      create_organization: {
        Args: {
          p_cnpj: string
          p_domain: string
          p_employees_range: string
          p_name: string
          p_partner_code: string
          p_sector: string
          p_terms_version: string
        }
        Returns: string
      }
      has_role: { Args: { p_org: string; p_roles: string[] }; Returns: boolean }
      is_member: { Args: { p_org: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      log_event: {
        Args: {
          p_action: string
          p_meta: Json
          p_org: string
          p_target: string
        }
        Returns: undefined
      }
      request_ip: { Args: never; Returns: unknown }
      revoke_agent_token: { Args: { p_token_id: string }; Returns: undefined }
      staff_review_control: {
        Args: {
          p_assessment: string
          p_control: string
          p_note: string
          p_status: string
        }
        Returns: undefined
      }
      submit_assessment: { Args: { p_assessment: string }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
