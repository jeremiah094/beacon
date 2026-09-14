// Generated via mcp__Supabase__generate_typescript_types — do not hand-edit.
// Regenerate after any schema migration (project: beacon / mcjxelzimstpebomjvqk).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      games: {
        Row: {
          game_number: number
          id: string
          league_id: string
          lineup_locked_at: string | null
          lobby_code: string | null
          round_number: number
          scheduled_at: string
          status: string
        }
        Insert: {
          game_number: number
          id?: string
          league_id: string
          lineup_locked_at?: string | null
          lobby_code?: string | null
          round_number?: number
          scheduled_at: string
          status?: string
        }
        Update: {
          game_number?: number
          id?: string
          league_id?: string
          lineup_locked_at?: string | null
          lobby_code?: string | null
          round_number?: number
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_teams: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          league_id: string
          rejection_reason: string | null
          status: string
          team_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          league_id: string
          rejection_reason?: string | null
          status?: string
          team_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          league_id?: string
          rejection_reason?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_teams_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string | null
          entry_rules: string | null
          format: string
          id: string
          name: string
          region: string
          season_end: string | null
          season_label: string | null
          season_start: string | null
          status: string
          teams_per_lobby: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_rules?: string | null
          format?: string
          id?: string
          name: string
          region?: string
          season_end?: string | null
          season_label?: string | null
          season_start?: string | null
          status?: string
          teams_per_lobby?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_rules?: string | null
          format?: string
          id?: string
          name?: string
          region?: string
          season_end?: string | null
          season_label?: string | null
          season_start?: string | null
          status?: string
          teams_per_lobby?: number
        }
        Relationships: [
          {
            foreignKeyName: "leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_players: {
        Row: {
          lineup_id: string
          profile_id: string
        }
        Insert: {
          lineup_id: string
          profile_id: string
        }
        Update: {
          lineup_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          confirmed_at: string | null
          game_id: string
          id: string
          locked_at: string | null
          team_id: string
        }
        Insert: {
          confirmed_at?: string | null
          game_id: string
          id?: string
          locked_at?: string | null
          team_id: string
        }
        Update: {
          confirmed_at?: string | null
          game_id?: string
          id?: string
          locked_at?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          game_id: string
          muted: boolean
          profile_id: string
        }
        Insert: {
          game_id: string
          muted?: boolean
          profile_id: string
        }
        Update: {
          game_id?: string
          muted?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          fetched_at: string | null
          kd: number | null
          level: number | null
          most_played_legend: string | null
          profile_id: string
          rank_name: string | null
          rank_score: number | null
          raw: Json | null
          wins: number | null
        }
        Insert: {
          fetched_at?: string | null
          kd?: number | null
          level?: number | null
          most_played_legend?: string | null
          profile_id: string
          rank_name?: string | null
          rank_score?: number | null
          raw?: Json | null
          wins?: number | null
        }
        Update: {
          fetched_at?: string | null
          kd?: number | null
          level?: number | null
          most_played_legend?: string | null
          profile_id?: string
          rank_name?: string | null
          rank_score?: number | null
          raw?: Json | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apex_platform: string | null
          apex_uid: string | null
          apex_verified_at: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          gamertag: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          apex_platform?: string | null
          apex_uid?: string | null
          apex_verified_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          gamertag?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          apex_platform?: string | null
          apex_uid?: string | null
          apex_verified_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          gamertag?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string | null
          profile_id: string
          token: string
        }
        Insert: {
          platform?: string | null
          profile_id: string
          token: string
        }
        Update: {
          platform?: string | null
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          entered_by: string | null
          game_id: string
          id: string
          kills: number | null
          placement: number | null
          published_at: string | null
          source: string
          team_id: string
        }
        Insert: {
          entered_by?: string | null
          game_id: string
          id?: string
          kills?: number | null
          placement?: number | null
          published_at?: string | null
          source?: string
          team_id: string
        }
        Update: {
          entered_by?: string | null
          game_id?: string
          id?: string
          kills?: number | null
          placement?: number | null
          published_at?: string | null
          source?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          applied_at: string
          applied_by: string | null
          game_id: string
          id: string
          in_profile_id: string | null
          out_profile_id: string | null
          reason: string | null
          team_id: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          game_id: string
          id?: string
          in_profile_id?: string | null
          out_profile_id?: string | null
          reason?: string | null
          team_id: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          game_id?: string
          id?: string
          in_profile_id?: string | null
          out_profile_id?: string | null
          reason?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_in_profile_id_fkey"
            columns: ["in_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_out_profile_id_fkey"
            columns: ["out_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          profile_id: string
          role: string
          team_id: string
        }
        Insert: {
          joined_at?: string
          profile_id: string
          role?: string
          team_id: string
        }
        Update: {
          joined_at?: string
          profile_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          captain_id: string | null
          created_at: string
          id: string
          name: string
          tag: string | null
        }
        Insert: {
          captain_id?: string | null
          created_at?: string
          id?: string
          name: string
          tag?: string | null
        }
        Update: {
          captain_id?: string | null
          created_at?: string
          id?: string
          name?: string
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      standings: {
        Row: {
          games_played: number | null
          league_id: string | null
          team_id: string | null
          total_kills: number | null
          total_placement_points: number | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      placement_points: { Args: { p_placement: number }; Returns: number }
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const
