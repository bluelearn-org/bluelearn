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
      guide_bases: {
        Row: {
          canonical_guide_id: string | null
          created_at: string
          forked_from_guide_base_id: string | null
          id: string
          knowledge_type: Database["public"]["Enums"]["knowledge_type"]
          slug: string | null
          status: Database["public"]["Enums"]["node_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          canonical_guide_id?: string | null
          created_at?: string
          forked_from_guide_base_id?: string | null
          id?: string
          knowledge_type: Database["public"]["Enums"]["knowledge_type"]
          slug?: string | null
          status?: Database["public"]["Enums"]["node_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          canonical_guide_id?: string | null
          created_at?: string
          forked_from_guide_base_id?: string | null
          id?: string
          knowledge_type?: Database["public"]["Enums"]["knowledge_type"]
          slug?: string | null
          status?: Database["public"]["Enums"]["node_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_bases_canonical_guide_id_fkey"
            columns: ["canonical_guide_id", "id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id", "guide_base_id"]
          },
          {
            foreignKeyName: "guide_bases_forked_from_guide_base_id_fkey"
            columns: ["forked_from_guide_base_id"]
            isOneToOne: false
            referencedRelation: "guide_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_edges: {
        Row: {
          created_at: string
          edge_type: Database["public"]["Enums"]["edge_type"]
          from_guide_base_id: string
          id: string
          is_suspended: boolean
          to_guide_base_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edge_type: Database["public"]["Enums"]["edge_type"]
          from_guide_base_id: string
          id?: string
          is_suspended?: boolean
          to_guide_base_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edge_type?: Database["public"]["Enums"]["edge_type"]
          from_guide_base_id?: string
          id?: string
          is_suspended?: boolean
          to_guide_base_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_edges_from_guide_base_id_fkey"
            columns: ["from_guide_base_id"]
            isOneToOne: false
            referencedRelation: "guide_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_edges_to_guide_base_id_fkey"
            columns: ["to_guide_base_id"]
            isOneToOne: false
            referencedRelation: "guide_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_review_cases: {
        Row: {
          case_id: string
          guide_revision_id: string
        }
        Insert: {
          case_id: string
          guide_revision_id: string
        }
        Update: {
          case_id?: string
          guide_revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_review_cases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "review_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_review_cases_guide_revision_id_fkey"
            columns: ["guide_revision_id"]
            isOneToOne: false
            referencedRelation: "guide_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_revisions: {
        Row: {
          approved_at: string | null
          author_id: string | null
          body: string | null
          change_summary: string | null
          created_at: string
          guide_id: string
          id: string
          is_purged: boolean
          status: Database["public"]["Enums"]["revision_status"]
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          author_id?: string | null
          body?: string | null
          change_summary?: string | null
          created_at?: string
          guide_id: string
          id?: string
          is_purged?: boolean
          status?: Database["public"]["Enums"]["revision_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          author_id?: string | null
          body?: string | null
          change_summary?: string | null
          created_at?: string
          guide_id?: string
          id?: string
          is_purged?: boolean
          status?: Database["public"]["Enums"]["revision_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_revisions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_revisions_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_subjects: {
        Row: {
          guide_base_id: string
          subject_id: string
        }
        Insert: {
          guide_base_id: string
          subject_id: string
        }
        Update: {
          guide_base_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_subjects_guide_base_id_fkey"
            columns: ["guide_base_id"]
            isOneToOne: false
            referencedRelation: "guide_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          author_id: string | null
          created_at: string
          current_revision_id: string | null
          guide_base_id: string
          id: string
          slug: string | null
          status: Database["public"]["Enums"]["node_status"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          current_revision_id?: string | null
          guide_base_id: string
          id?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["node_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          current_revision_id?: string | null
          guide_base_id?: string
          id?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["node_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guides_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guides_current_revision_id_fkey"
            columns: ["current_revision_id", "id"]
            isOneToOne: false
            referencedRelation: "guide_revisions"
            referencedColumns: ["id", "guide_id"]
          },
          {
            foreignKeyName: "guides_guide_base_id_fkey"
            columns: ["guide_base_id"]
            isOneToOne: false
            referencedRelation: "guide_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_revision_edges: {
        Row: {
          from_guide_base_id: string
          revision_id: string
          to_guide_base_id: string
        }
        Insert: {
          from_guide_base_id: string
          revision_id: string
          to_guide_base_id: string
        }
        Update: {
          from_guide_base_id?: string
          revision_id?: string
          to_guide_base_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_revision_edges_from_is_node"
            columns: ["revision_id", "from_guide_base_id"]
            isOneToOne: false
            referencedRelation: "learning_path_revision_nodes"
            referencedColumns: ["revision_id", "guide_base_id"]
          },
          {
            foreignKeyName: "learning_path_revision_edges_to_is_node"
            columns: ["revision_id", "to_guide_base_id"]
            isOneToOne: false
            referencedRelation: "learning_path_revision_nodes"
            referencedColumns: ["revision_id", "guide_base_id"]
          },
        ]
      }
      learning_path_revision_nodes: {
        Row: {
          guide_base_id: string
          guide_id: string
          is_included: boolean
          is_target: boolean
          note: string | null
          revision_id: string
        }
        Insert: {
          guide_base_id: string
          guide_id: string
          is_included?: boolean
          is_target?: boolean
          note?: string | null
          revision_id: string
        }
        Update: {
          guide_base_id?: string
          guide_id?: string
          is_included?: boolean
          is_target?: boolean
          note?: string | null
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_revision_nodes_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "learning_path_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_revision_nodes_variant_of_base"
            columns: ["guide_id", "guide_base_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id", "guide_base_id"]
          },
        ]
      }
      learning_path_revisions: {
        Row: {
          author_id: string | null
          change_summary: string | null
          created_at: string
          id: string
          learning_path_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["learning_path_revision_status"]
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          change_summary?: string | null
          created_at?: string
          id?: string
          learning_path_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["learning_path_revision_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          change_summary?: string | null
          created_at?: string
          id?: string
          learning_path_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["learning_path_revision_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_revisions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_revisions_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          created_at: string
          created_by: string | null
          current_revision_id: string | null
          id: string
          slug: string | null
          status: Database["public"]["Enums"]["node_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["node_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["node_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_paths_current_revision_id_fkey"
            columns: ["current_revision_id", "id"]
            isOneToOne: false
            referencedRelation: "learning_path_revisions"
            referencedColumns: ["id", "learning_path_id"]
          },
        ]
      }
      media_assets: {
        Row: {
          created_at: string
          id: string
          storage_key: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          storage_key: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          storage_key?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_members: {
        Row: {
          assigned_at: string
          id: string
          member_id: string | null
          panel_id: string
          status: Database["public"]["Enums"]["seat_status"]
        }
        Insert: {
          assigned_at?: string
          id?: string
          member_id?: string | null
          panel_id: string
          status?: Database["public"]["Enums"]["seat_status"]
        }
        Update: {
          assigned_at?: string
          id?: string
          member_id?: string | null
          panel_id?: string
          status?: Database["public"]["Enums"]["seat_status"]
        }
        Relationships: [
          {
            foreignKeyName: "panel_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panel_members_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "review_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_suspended: boolean
          updated_at: string
          username: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_suspended?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_suspended?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      review_cases: {
        Row: {
          case_type: Database["public"]["Enums"]["case_type"]
          created_at: string
          created_by: string | null
          id: string
          status: Database["public"]["Enums"]["case_status"]
          time_limit: string | null
          updated_at: string
        }
        Insert: {
          case_type: Database["public"]["Enums"]["case_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["case_status"]
          time_limit?: string | null
          updated_at?: string
        }
        Update: {
          case_type?: Database["public"]["Enums"]["case_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["case_status"]
          time_limit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_decision_reasons: {
        Row: {
          decision_id: string
          reason: Database["public"]["Enums"]["decision_reason"]
        }
        Insert: {
          decision_id: string
          reason: Database["public"]["Enums"]["decision_reason"]
        }
        Update: {
          decision_id?: string
          reason?: Database["public"]["Enums"]["decision_reason"]
        }
        Relationships: [
          {
            foreignKeyName: "review_decision_reasons_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "review_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_decisions: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["review_outcome"]
          id: string
          notes: string | null
          panel_member_id: string
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["review_outcome"]
          id?: string
          notes?: string | null
          panel_member_id: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["review_outcome"]
          id?: string
          notes?: string | null
          panel_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_decisions_panel_member_id_fkey"
            columns: ["panel_member_id"]
            isOneToOne: true
            referencedRelation: "panel_members"
            referencedColumns: ["id"]
          },
        ]
      }
      review_panels: {
        Row: {
          case_id: string
          closed_at: string | null
          id: string
          opened_at: string
          outcome: Database["public"]["Enums"]["review_outcome"] | null
          target_seat_count: number
        }
        Insert: {
          case_id: string
          closed_at?: string | null
          id?: string
          opened_at?: string
          outcome?: Database["public"]["Enums"]["review_outcome"] | null
          target_seat_count: number
        }
        Update: {
          case_id?: string
          closed_at?: string | null
          id?: string
          opened_at?: string
          outcome?: Database["public"]["Enums"]["review_outcome"] | null
          target_seat_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_panels_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_assets: {
        Row: {
          asset_id: string
          revision_id: string
        }
        Insert: {
          asset_id: string
          revision_id: string
        }
        Update: {
          asset_id?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_assets_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "guide_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          creator_id: string | null
          id: string
          name: string
          slug: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          id?: string
          name: string
          slug: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          id?: string
          name?: string
          slug?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_prerequisites: {
        Row: {
          created_at: string
          dependent_guide_base_id: string
          id: string
          resolved_guide_base_id: string | null
          status: Database["public"]["Enums"]["todo_status"]
          title: string
        }
        Insert: {
          created_at?: string
          dependent_guide_base_id: string
          id?: string
          resolved_guide_base_id?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          title: string
        }
        Update: {
          created_at?: string
          dependent_guide_base_id?: string
          id?: string
          resolved_guide_base_id?: string | null
          status?: Database["public"]["Enums"]["todo_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_prerequisites_dependent_guide_base_id_fkey"
            columns: ["dependent_guide_base_id"]
            isOneToOne: false
            referencedRelation: "guide_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_prerequisites_resolved_guide_base_id_fkey"
            columns: ["resolved_guide_base_id"]
            isOneToOne: false
            referencedRelation: "guide_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["vote_direction"]
          guide_id: string
          note: string | null
          reason: Database["public"]["Enums"]["downvote_reason"] | null
          updated_at: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["vote_direction"]
          guide_id: string
          note?: string | null
          reason?: Database["public"]["Enums"]["downvote_reason"] | null
          updated_at?: string
          voter_id: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["vote_direction"]
          guide_id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["downvote_reason"] | null
          updated_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      guide_vote_tallies: {
        Row: {
          downvotes: number | null
          guide_id: string | null
          upvotes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      compute_walkthrough: { Args: { p_guide_base_id: string }; Returns: Json }
      create_guide: {
        Args: {
          p_body?: string
          p_knowledge_type?: Database["public"]["Enums"]["knowledge_type"]
          p_summary?: string
          p_title?: string
        }
        Returns: string
      }
      create_learning_path: {
        Args: { p_summary?: string; p_targets: string[]; p_title?: string }
        Returns: string
      }
      create_variant: {
        Args: {
          p_body?: string
          p_guide_base_id: string
          p_summary?: string
          p_title?: string
        }
        Returns: string
      }
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      project_path_edges: {
        Args: { p_revision_id: string }
        Returns: {
          from_guide_base_id: string
          to_guide_base_id: string
        }[]
      }
      publish_learning_path_revision: {
        Args: { p_revision_id: string }
        Returns: string
      }
      submit_guide_revision: {
        Args: { p_revision_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "verifier" | "moderator" | "curator" | "admin"
      case_status: "pending" | "in_review" | "approved" | "rejected"
      case_type: "guide_publish" | "guide_edit"
      decision_reason:
        | "hierarchy_issue"
        | "factual_error"
        | "duplicate_content"
        | "scope_violation"
        | "clarity_issue"
        | "missing_required_information"
      downvote_reason:
        | "unclear"
        | "factually_wrong"
        | "missing_step"
        | "outdated"
        | "broken_link"
        | "prereq_gap"
        | "wrong_level"
        | "scope_creep"
      edge_type: "prerequisite" | "related"
      knowledge_type: "theory" | "practice"
      learning_path_revision_status: "draft" | "published"
      node_status: "draft" | "published" | "archived"
      review_outcome: "approved" | "rejected"
      revision_status: "draft" | "submitted"
      seat_status: "assigned" | "recused" | "replaced" | "completed"
      todo_status: "open" | "resolved"
      vote_direction: "up" | "down"
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
    Enums: {
      app_role: ["verifier", "moderator", "curator", "admin"],
      case_status: ["pending", "in_review", "approved", "rejected"],
      case_type: ["guide_publish", "guide_edit"],
      decision_reason: [
        "hierarchy_issue",
        "factual_error",
        "duplicate_content",
        "scope_violation",
        "clarity_issue",
        "missing_required_information",
      ],
      downvote_reason: [
        "unclear",
        "factually_wrong",
        "missing_step",
        "outdated",
        "broken_link",
        "prereq_gap",
        "wrong_level",
        "scope_creep",
      ],
      edge_type: ["prerequisite", "related"],
      knowledge_type: ["theory", "practice"],
      learning_path_revision_status: ["draft", "published"],
      node_status: ["draft", "published", "archived"],
      review_outcome: ["approved", "rejected"],
      revision_status: ["draft", "submitted"],
      seat_status: ["assigned", "recused", "replaced", "completed"],
      todo_status: ["open", "resolved"],
      vote_direction: ["up", "down"],
    },
  },
} as const
