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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agora_files: {
        Row: {
          agora_id: string
          created_at: string
          file_name: string
          id: string
          size_bytes: number | null
          storage_path: string
          title: string | null
          uploader_id: string
        }
        Insert: {
          agora_id: string
          created_at?: string
          file_name: string
          id?: string
          size_bytes?: number | null
          storage_path: string
          title?: string | null
          uploader_id: string
        }
        Update: {
          agora_id?: string
          created_at?: string
          file_name?: string
          id?: string
          size_bytes?: number | null
          storage_path?: string
          title?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agora_files_agora_id_fkey"
            columns: ["agora_id"]
            isOneToOne: false
            referencedRelation: "agoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agora_files_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agora_join_requests: {
        Row: {
          agora_id: string
          created_at: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          agora_id: string
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          agora_id?: string
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agora_join_requests_agora_id_fkey"
            columns: ["agora_id"]
            isOneToOne: false
            referencedRelation: "agoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agora_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agora_members: {
        Row: {
          agora_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          agora_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          agora_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agora_members_agora_id_fkey"
            columns: ["agora_id"]
            isOneToOne: false
            referencedRelation: "agoras"
            referencedColumns: ["id"]
          },
        ]
      }
      agora_messages: {
        Row: {
          agora_id: string
          author_id: string
          created_at: string
          id: string
          message: string
        }
        Insert: {
          agora_id: string
          author_id: string
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          agora_id?: string
          author_id?: string
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "agora_messages_agora_id_fkey"
            columns: ["agora_id"]
            isOneToOne: false
            referencedRelation: "agoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agora_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agoras: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      ai_missions: {
        Row: {
          audit_date: string | null
          completed: boolean
          created_at: string
          description: string
          expired_at: string | null
          expires_at: string | null
          frequency: string
          id: string
          progress_pct: number
          reflection_answer: string | null
          reflection_answered_at: string | null
          requires_reflection: boolean
          reward_xp: number
          title: string
          user_id: string
          xp_awarded: boolean
        }
        Insert: {
          audit_date?: string | null
          completed?: boolean
          created_at?: string
          description: string
          expired_at?: string | null
          expires_at?: string | null
          frequency?: string
          id?: string
          progress_pct?: number
          reflection_answer?: string | null
          reflection_answered_at?: string | null
          requires_reflection?: boolean
          reward_xp?: number
          title: string
          user_id: string
          xp_awarded?: boolean
        }
        Update: {
          audit_date?: string | null
          completed?: boolean
          created_at?: string
          description?: string
          expired_at?: string | null
          expires_at?: string | null
          frequency?: string
          id?: string
          progress_pct?: number
          reflection_answer?: string | null
          reflection_answered_at?: string | null
          requires_reflection?: boolean
          reward_xp?: number
          title?: string
          user_id?: string
          xp_awarded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_missions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_session_verdicts: {
        Row: {
          ataraxia_score: number | null
          created_at: string
          id: string
          session_date: string
          user_id: string
          verdict: string
          went_well: string[]
          went_wrong: string[]
        }
        Insert: {
          ataraxia_score?: number | null
          created_at?: string
          id?: string
          session_date: string
          user_id: string
          verdict: string
          went_well?: string[]
          went_wrong?: string[]
        }
        Update: {
          ataraxia_score?: number | null
          created_at?: string
          id?: string
          session_date?: string
          user_id?: string
          verdict?: string
          went_well?: string[]
          went_wrong?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ai_session_verdicts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connections: {
        Row: {
          broker: string
          connected_at: string
          credentials: Json
          id: string
          user_id: string
        }
        Insert: {
          broker: string
          connected_at?: string
          credentials: Json
          id?: string
          user_id: string
        }
        Update: {
          broker?: string
          connected_at?: string
          credentials?: Json
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      core_mission_completions: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          mission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          mission_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          mission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_feedback: {
        Row: {
          author_id: string
          created_at: string | null
          id: string
          journal_entry_id: string
          message: string
        }
        Insert: {
          author_id: string
          created_at?: string | null
          id?: string
          journal_entry_id: string
          message: string
        }
        Update: {
          author_id?: string
          created_at?: string | null
          id?: string
          journal_entry_id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_feedback_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          from_user: string
          id: string
          responded_at: string | null
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string | null
          from_user: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string | null
          from_user?: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user?: string
        }
        Relationships: []
      }
      funding_account_balance_events: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          funding_account_id: string
          id: string
          journal_entry_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          funding_account_id: string
          id?: string
          journal_entry_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          funding_account_id?: string
          id?: string
          journal_entry_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_account_balance_events_funding_account_id_fkey"
            columns: ["funding_account_id"]
            isOneToOne: false
            referencedRelation: "funding_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_account_balance_events_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_account_balance_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          created_at: string
          current_balance: number
          daily_loss_limit: number | null
          drawdown_limit: number
          drawdown_type: string
          id: string
          profit_target: number
          starting_balance: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string
          created_at?: string
          current_balance: number
          daily_loss_limit?: number | null
          drawdown_limit: number
          drawdown_type?: string
          id?: string
          profit_target: number
          starting_balance: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          created_at?: string
          current_balance?: number
          daily_loss_limit?: number | null
          drawdown_limit?: number
          drawdown_type?: string
          id?: string
          profit_target?: number
          starting_balance?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_payouts: {
        Row: {
          amount: number
          created_at: string
          funding_account_id: string | null
          id: string
          payout_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          funding_account_id?: string | null
          id?: string
          payout_date: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          funding_account_id?: string | null
          id?: string
          payout_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_payouts_funding_account_id_fkey"
            columns: ["funding_account_id"]
            isOneToOne: false
            referencedRelation: "funding_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress_events: {
        Row: {
          created_at: string
          delta: number
          goal_id: string
          goal_text: string
          id: string
          new_pct: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          goal_id: string
          goal_text: string
          id?: string
          new_pct: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          goal_id?: string
          goal_text?: string
          id?: string
          new_pct?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          ami_winrate: number | null
          created_at: string | null
          custom_fields: Json | null
          directriz: string | null
          discipline_break_note: string | null
          discipline_break_reason: string | null
          emotional_state: string | null
          entry_date: string
          followed_scenario: boolean | null
          id: string
          market_context: string | null
          post_market_analysis: string | null
          scenario_id: string | null
          screenshots: Json
          top_down: Json | null
          user_id: string
          x2c_winrate: number | null
        }
        Insert: {
          ami_winrate?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          directriz?: string | null
          discipline_break_note?: string | null
          discipline_break_reason?: string | null
          emotional_state?: string | null
          entry_date: string
          followed_scenario?: boolean | null
          id?: string
          market_context?: string | null
          post_market_analysis?: string | null
          scenario_id?: string | null
          screenshots?: Json
          top_down?: Json | null
          user_id: string
          x2c_winrate?: number | null
        }
        Update: {
          ami_winrate?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          directriz?: string | null
          discipline_break_note?: string | null
          discipline_break_reason?: string | null
          emotional_state?: string | null
          entry_date?: string
          followed_scenario?: boolean | null
          id?: string
          market_context?: string | null
          post_market_analysis?: string | null
          scenario_id?: string | null
          screenshots?: Json
          top_down?: Json | null
          user_id?: string
          x2c_winrate?: number | null
        }
        Relationships: []
      }
      journal_funding_accounts: {
        Row: {
          created_at: string
          funding_account_id: string
          id: string
          journal_entry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          funding_account_id: string
          id?: string
          journal_entry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          funding_account_id?: string
          id?: string
          journal_entry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_funding_accounts_funding_account_id_fkey"
            columns: ["funding_account_id"]
            isOneToOne: false
            referencedRelation: "funding_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_funding_accounts_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_funding_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_shares: {
        Row: {
          agora_id: string | null
          created_at: string | null
          from_user: string
          id: string
          journal_entry_id: string
          to_user: string
        }
        Insert: {
          agora_id?: string | null
          created_at?: string | null
          from_user: string
          id?: string
          journal_entry_id: string
          to_user: string
        }
        Update: {
          agora_id?: string | null
          created_at?: string | null
          from_user?: string
          id?: string
          journal_entry_id?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_shares_agora_id_fkey"
            columns: ["agora_id"]
            isOneToOne: false
            referencedRelation: "agoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_shares_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_templates: {
        Row: {
          id: string
          sections: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          sections?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          sections?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      medal_unlocks: {
        Row: {
          id: string
          mission_key: string
          points: number
          tier_index: number
          tier_name: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mission_key: string
          points: number
          tier_index: number
          tier_name: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mission_key?: string
          points?: number
          tier_index?: number
          tier_name?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      omega_audits: {
        Row: {
          acknowledged_at: string | null
          audit_date: string
          created_at: string
          daily_feedback: string
          daily_missions: Json
          game_state: string
          id: string
          manual_audit: Json
          strengths: Json
          user_id: string
          weaknesses: Json
        }
        Insert: {
          acknowledged_at?: string | null
          audit_date: string
          created_at?: string
          daily_feedback: string
          daily_missions?: Json
          game_state: string
          id?: string
          manual_audit?: Json
          strengths?: Json
          user_id: string
          weaknesses?: Json
        }
        Update: {
          acknowledged_at?: string | null
          audit_date?: string
          created_at?: string
          daily_feedback?: string
          daily_missions?: Json
          game_state?: string
          id?: string
          manual_audit?: Json
          strengths?: Json
          user_id?: string
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "omega_audits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      omega_briefings: {
        Row: {
          acknowledged_at: string | null
          briefing_date: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          briefing_date: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          briefing_date?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omega_briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_funding_accounts: {
        Row: {
          funding_account_id: string
          operation_id: string
        }
        Insert: {
          funding_account_id: string
          operation_id: string
        }
        Update: {
          funding_account_id?: string
          operation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_funding_accounts_funding_account_id_fkey"
            columns: ["funding_account_id"]
            isOneToOne: false
            referencedRelation: "funding_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_funding_accounts_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          account_label: string | null
          broke_plan: boolean
          broker_source: string | null
          created_at: string
          direction: string | null
          entry_date: string
          entry_price: number | null
          entry_time: string | null
          exit_time: string | null
          id: string
          is_auto_synced: boolean
          journal_entry_id: string
          lesson: string | null
          lot_size: number | null
          model: string | null
          outcome: string | null
          pnl: number | null
          quality: string | null
          risk_reward: string | null
          screenshots: Json
          session: string | null
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          user_id: string
        }
        Insert: {
          account_label?: string | null
          broke_plan?: boolean
          broker_source?: string | null
          created_at?: string
          direction?: string | null
          entry_date: string
          entry_price?: number | null
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          is_auto_synced?: boolean
          journal_entry_id: string
          lesson?: string | null
          lot_size?: number | null
          model?: string | null
          outcome?: string | null
          pnl?: number | null
          quality?: string | null
          risk_reward?: string | null
          screenshots?: Json
          session?: string | null
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          user_id: string
        }
        Update: {
          account_label?: string | null
          broke_plan?: boolean
          broker_source?: string | null
          created_at?: string
          direction?: string | null
          entry_date?: string
          entry_price?: number | null
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          is_auto_synced?: boolean
          journal_entry_id?: string
          lesson?: string | null
          lot_size?: number | null
          model?: string | null
          outcome?: string | null
          pnl?: number | null
          quality?: string | null
          risk_reward?: string | null
          screenshots?: Json
          session?: string | null
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      post_session_responses: {
        Row: {
          additional_comments: string | null
          ataraxia_score: number | null
          bias_correct: boolean | null
          created_at: string
          dol_swept: boolean | null
          id: string
          narrative_followed: boolean | null
          notes_bias: string | null
          notes_dol: string | null
          notes_narrative: string | null
          notes_price: string | null
          notes_psychology: string | null
          notes_risk: string | null
          notes_setup: string | null
          predominant_emotions: string[] | null
          price_reading: number | null
          psychology_rating: string | null
          risk_respected: string | null
          setup_compliant: string | null
          user_id: string
        }
        Insert: {
          additional_comments?: string | null
          ataraxia_score?: number | null
          bias_correct?: boolean | null
          created_at?: string
          dol_swept?: boolean | null
          id?: string
          narrative_followed?: boolean | null
          notes_bias?: string | null
          notes_dol?: string | null
          notes_narrative?: string | null
          notes_price?: string | null
          notes_psychology?: string | null
          notes_risk?: string | null
          notes_setup?: string | null
          predominant_emotions?: string[] | null
          price_reading?: number | null
          psychology_rating?: string | null
          risk_respected?: string | null
          setup_compliant?: string | null
          user_id: string
        }
        Update: {
          additional_comments?: string | null
          ataraxia_score?: number | null
          bias_correct?: boolean | null
          created_at?: string
          dol_swept?: boolean | null
          id?: string
          narrative_followed?: boolean | null
          notes_bias?: string | null
          notes_dol?: string | null
          notes_narrative?: string | null
          notes_price?: string | null
          notes_psychology?: string | null
          notes_risk?: string | null
          notes_setup?: string | null
          predominant_emotions?: string[] | null
          price_reading?: number | null
          psychology_rating?: string | null
          risk_respected?: string | null
          setup_compliant?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pre_session_responses: {
        Row: {
          caffeine_mg: number | null
          created_at: string
          exercised: boolean | null
          feeling: string
          id: string
          intentions: string[] | null
          life_stressors: string | null
          mindset: string
          sleep_hours: number | null
          user_id: string
          why_trading: string
        }
        Insert: {
          caffeine_mg?: number | null
          created_at?: string
          exercised?: boolean | null
          feeling: string
          id?: string
          intentions?: string[] | null
          life_stressors?: string | null
          mindset: string
          sleep_hours?: number | null
          user_id: string
          why_trading: string
        }
        Update: {
          caffeine_mg?: number | null
          created_at?: string
          exercised?: boolean | null
          feeling?: string
          id?: string
          intentions?: string[] | null
          life_stressors?: string | null
          mindset?: string
          sleep_hours?: number | null
          user_id?: string
          why_trading?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          last_seen_at: string | null
          peak_virtus_total: number
          perfil_psicologico_actual: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          last_seen_at?: string | null
          peak_virtus_total?: number
          perfil_psicologico_actual?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          last_seen_at?: string | null
          peak_virtus_total?: number
          perfil_psicologico_actual?: string | null
        }
        Relationships: []
      }
      psychological_growth_events: {
        Row: {
          category: string
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psychological_growth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          operation_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          operation_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          operation_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_embeddings_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: true
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_plan: {
        Row: {
          capital_preservation_rules: string | null
          extra_notes: string | null
          goals: Json
          id: string
          losing_streak_plan: string | null
          macro_event_plan: string | null
          market_analysis_rules: string | null
          max_trades_per_session: string | null
          max_weekly_drawdown: string | null
          no_trade_days: string | null
          onboarding_completed: boolean
          payout_plan: string | null
          position_management: string | null
          psychological_rules: string | null
          quality_tiers: Json
          risk_management: string | null
          scenarios: Json
          schedule_end: string | null
          schedule_start: string | null
          session_time: string | null
          setups: Json
          terms_accepted_at: string | null
          terms_version: string | null
          trader_type: string | null
          trades_crypto: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          capital_preservation_rules?: string | null
          extra_notes?: string | null
          goals?: Json
          id?: string
          losing_streak_plan?: string | null
          macro_event_plan?: string | null
          market_analysis_rules?: string | null
          max_trades_per_session?: string | null
          max_weekly_drawdown?: string | null
          no_trade_days?: string | null
          onboarding_completed?: boolean
          payout_plan?: string | null
          position_management?: string | null
          psychological_rules?: string | null
          quality_tiers?: Json
          risk_management?: string | null
          scenarios?: Json
          schedule_end?: string | null
          schedule_start?: string | null
          session_time?: string | null
          setups?: Json
          terms_accepted_at?: string | null
          terms_version?: string | null
          trader_type?: string | null
          trades_crypto?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          capital_preservation_rules?: string | null
          extra_notes?: string | null
          goals?: Json
          id?: string
          losing_streak_plan?: string | null
          macro_event_plan?: string | null
          market_analysis_rules?: string | null
          max_trades_per_session?: string | null
          max_weekly_drawdown?: string | null
          no_trade_days?: string | null
          onboarding_completed?: boolean
          payout_plan?: string | null
          position_management?: string | null
          psychological_rules?: string | null
          quality_tiers?: Json
          risk_management?: string | null
          scenarios?: Json
          schedule_end?: string | null
          schedule_start?: string | null
          session_time?: string | null
          setups?: Json
          terms_accepted_at?: string | null
          terms_version?: string | null
          trader_type?: string | null
          trades_crypto?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_rule_chunks: {
        Row: {
          category: string | null
          chunk_text: string | null
          embedding: string | null
          id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          chunk_text?: string | null
          embedding?: string | null
          id?: string
          user_id: string
        }
        Update: {
          category?: string | null
          chunk_text?: string | null
          embedding?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      virtus_ai_events: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtus_ai_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      virtus_events: {
        Row: {
          created_at: string
          id: string
          journal_entry_id: string | null
          label: string
          points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          label: string
          points: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          label?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtus_events_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      weekday_playbook: {
        Row: {
          ami_target_winrate: number | null
          directriz_detalle: string | null
          directriz_titulo: string | null
          id: string
          ipda_profile: string | null
          leading_model: string | null
          nota_secundaria: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
          weekday: number
          x2c_target_winrate: number | null
        }
        Insert: {
          ami_target_winrate?: number | null
          directriz_detalle?: string | null
          directriz_titulo?: string | null
          id?: string
          ipda_profile?: string | null
          leading_model?: string | null
          nota_secundaria?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
          weekday: number
          x2c_target_winrate?: number | null
        }
        Update: {
          ami_target_winrate?: number | null
          directriz_detalle?: string | null
          directriz_titulo?: string | null
          id?: string
          ipda_profile?: string | null
          leading_model?: string | null
          nota_secundaria?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
          weekday?: number
          x2c_target_winrate?: number | null
        }
        Relationships: []
      }
      weekly_missions: {
        Row: {
          created_at: string
          id: string
          mission_key: string
          points: number
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_key: string
          points: number
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_key?: string
          points?: number
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_funding_account_pnl: {
        Args: {
          p_account_id: string
          p_delta: number
          p_journal_entry_id?: string
          p_reason: string
          p_user_id: string
        }
        Returns: number
      }
      apply_goal_progress_delta: {
        Args: { p_delta: number; p_goal_id: string; p_user_id: string }
        Returns: number
      }
      apply_mission_progress: {
        Args: { p_delta: number; p_mission_id: string; p_user_id: string }
        Returns: number
      }
      get_agora_member_virtus_stage: {
        Args: { target_user: string }
        Returns: string
      }
      get_friend_gamification: { Args: { friend_id: string }; Returns: Json }
      get_friend_virtus_stage: {
        Args: { target_user: string }
        Returns: string
      }
      has_broker_connection: { Args: { broker_name: string }; Returns: boolean }
      is_agora_member: {
        Args: { target_agora: string; target_user: string }
        Returns: boolean
      }
      is_agora_owner: {
        Args: { target_agora: string; target_user: string }
        Returns: boolean
      }
      match_trade_embeddings: {
        Args: {
          p_before_date: string
          p_match_count?: number
          p_query_embedding: string
          p_user_id: string
        }
        Returns: {
          entry_date: string
          lesson: string
          model: string
          operation_id: string
          similarity: number
          symbol: string
        }[]
      }
      match_trades: {
        Args: {
          match_count: number
          match_threshold: number
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          operation_id: string
          similarity: number
        }[]
      }
      match_user_rule_chunks: {
        Args: {
          match_count: number
          match_threshold: number
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          chunk_text: string
          id: string
          similarity: number
        }[]
      }
      search_agoras: {
        Args: { query: string }
        Returns: {
          id: string
          member_count: number
          name: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
