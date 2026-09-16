/**
 * GENERATED — do not edit by hand.
 *
 * Produced by `npm run db:types:local`, which applies supabase/migrations to an
 * in-process Postgres and introspects the result. It therefore matches the
 * migrations by construction.
 *
 * Once the local Supabase stack is running (Docker), regenerate with the real
 * tool instead:  npm run db:types
 * Any drift between the two will surface immediately as a typecheck error.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activation_requests: {
        Row: {
          id: string
          institute_id: string
          class_subject_id: string
          requested_by: string | null
          status: string
          reason: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
        }
        Insert: {
          id?: string
          institute_id: string
          class_subject_id: string
          requested_by?: string | null
          status?: string
          reason?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
        }
        Update: {
          id?: string
          institute_id?: string
          class_subject_id?: string
          requested_by?: string | null
          status?: string
          reason?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
        }
        Relationships: []
      }
      attempt_items: {
        Row: {
          id: string
          institute_id: string
          attempt_id: string
          question_id: string
          is_correct: boolean
          display_position: number | null
        }
        Insert: {
          id?: string
          institute_id: string
          attempt_id: string
          question_id: string
          is_correct: boolean
          display_position?: number | null
        }
        Update: {
          id?: string
          institute_id?: string
          attempt_id?: string
          question_id?: string
          is_correct?: boolean
          display_position?: number | null
        }
        Relationships: []
      }
      attempts: {
        Row: {
          id: string
          institute_id: string
          paper_id: string
          student_id: string
          paper_set_id: string | null
          logged_at: string
          source: string
        }
        Insert: {
          id?: string
          institute_id: string
          paper_id: string
          student_id: string
          paper_set_id?: string | null
          logged_at?: string
          source?: string
        }
        Update: {
          id?: string
          institute_id?: string
          paper_id?: string
          student_id?: string
          paper_set_id?: string | null
          logged_at?: string
          source?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          id: string
          institute_id: string
          name: string
          class_subject_id: string
          teacher_id: string | null
          join_code: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          institute_id: string
          name: string
          class_subject_id: string
          teacher_id?: string | null
          join_code: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          institute_id?: string
          name?: string
          class_subject_id?: string
          teacher_id?: string | null
          join_code?: string
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          id: string
          class_subject_id: string
          strand_id: string | null
          name: string
          ncert_number: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          class_subject_id: string
          strand_id?: string | null
          name: string
          ncert_number?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          class_subject_id?: string
          strand_id?: string | null
          name?: string
          ncert_number?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      class_subjects: {
        Row: {
          id: string
          class_id: string
          subject_id: string
          bank_status: string
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          subject_id: string
          bank_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          subject_id?: string
          bank_status?: string
          created_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      coverage_gaps: {
        Row: {
          id: string
          institute_id: string
          class_subject_id: string
          topic_id: string | null
          difficulty: string | null
          severity: string
          detected_at: string
          note: string | null
        }
        Insert: {
          id?: string
          institute_id: string
          class_subject_id: string
          topic_id?: string | null
          difficulty?: string | null
          severity?: string
          detected_at?: string
          note?: string | null
        }
        Update: {
          id?: string
          institute_id?: string
          class_subject_id?: string
          topic_id?: string | null
          difficulty?: string | null
          severity?: string
          detected_at?: string
          note?: string | null
        }
        Relationships: []
      }
      enrolments: {
        Row: {
          institute_id: string
          batch_id: string
          student_id: string
          class_subject_id: string
          joined_at: string
        }
        Insert: {
          institute_id: string
          batch_id: string
          student_id: string
          class_subject_id: string
          joined_at?: string
        }
        Update: {
          institute_id?: string
          batch_id?: string
          student_id?: string
          class_subject_id?: string
          joined_at?: string
        }
        Relationships: []
      }
      institute_class_subjects: {
        Row: {
          institute_id: string
          class_subject_id: string
          status: string
          activated_at: string | null
          activated_by: string | null
        }
        Insert: {
          institute_id: string
          class_subject_id: string
          status?: string
          activated_at?: string | null
          activated_by?: string | null
        }
        Update: {
          institute_id?: string
          class_subject_id?: string
          status?: string
          activated_at?: string | null
          activated_by?: string | null
        }
        Relationships: []
      }
      institute_invites: {
        Row: {
          id: string
          institute_id: string
          email: string
          role: string
          invited_by: string | null
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          institute_id: string
          email: string
          role: string
          invited_by?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          institute_id?: string
          email?: string
          role?: string
          invited_by?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      institute_members: {
        Row: {
          institute_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          institute_id: string
          user_id: string
          role: string
          created_at?: string
        }
        Update: {
          institute_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      institutes: {
        Row: {
          id: string
          name: string
          slug: string
          kind: string
          status: string
          contact_email: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          kind: string
          status?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          kind?: string
          status?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      paper_blocks: {
        Row: {
          id: string
          institute_id: string
          paper_id: string
          section_id: string
          canonical_position: number
          stimulus_id: string | null
          locked: boolean
        }
        Insert: {
          id?: string
          institute_id: string
          paper_id: string
          section_id: string
          canonical_position: number
          stimulus_id?: string | null
          locked?: boolean
        }
        Update: {
          id?: string
          institute_id?: string
          paper_id?: string
          section_id?: string
          canonical_position?: number
          stimulus_id?: string | null
          locked?: boolean
        }
        Relationships: []
      }
      paper_patterns: {
        Row: {
          id: string
          owner_institute_id: string
          class_subject_id: string
          name: string
          total_marks: number
          duration_min: number | null
          origin: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_institute_id: string
          class_subject_id: string
          name: string
          total_marks: number
          duration_min?: number | null
          origin: string
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_institute_id?: string
          class_subject_id?: string
          name?: string
          total_marks?: number
          duration_min?: number | null
          origin?: string
          is_default?: boolean
          created_at?: string
        }
        Relationships: []
      }
      paper_questions: {
        Row: {
          id: string
          institute_id: string
          paper_id: string
          block_id: string
          question_id: string
          within_block_order: number
          marks: number
          is_choice_alternative: boolean
        }
        Insert: {
          id?: string
          institute_id: string
          paper_id: string
          block_id: string
          question_id: string
          within_block_order?: number
          marks: number
          is_choice_alternative?: boolean
        }
        Update: {
          id?: string
          institute_id?: string
          paper_id?: string
          block_id?: string
          question_id?: string
          within_block_order?: number
          marks?: number
          is_choice_alternative?: boolean
        }
        Relationships: []
      }
      paper_sections: {
        Row: {
          id: string
          institute_id: string
          paper_id: string
          pattern_section_id: string | null
          label: string
          sort_order: number
        }
        Insert: {
          id?: string
          institute_id: string
          paper_id: string
          pattern_section_id?: string | null
          label: string
          sort_order?: number
        }
        Update: {
          id?: string
          institute_id?: string
          paper_id?: string
          pattern_section_id?: string | null
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      paper_set_items: {
        Row: {
          id: string
          institute_id: string
          paper_set_id: string
          paper_block_id: string
          display_position: number
        }
        Insert: {
          id?: string
          institute_id: string
          paper_set_id: string
          paper_block_id: string
          display_position: number
        }
        Update: {
          id?: string
          institute_id?: string
          paper_set_id?: string
          paper_block_id?: string
          display_position?: number
        }
        Relationships: []
      }
      paper_set_options: {
        Row: {
          id: string
          institute_id: string
          paper_set_id: string
          paper_question_id: string
          option_order: string[]
        }
        Insert: {
          id?: string
          institute_id: string
          paper_set_id: string
          paper_question_id: string
          option_order: string[]
        }
        Update: {
          id?: string
          institute_id?: string
          paper_set_id?: string
          paper_question_id?: string
          option_order?: string[]
        }
        Relationships: []
      }
      paper_sets: {
        Row: {
          id: string
          institute_id: string
          paper_id: string
          set_label: string
          copies_to_print: number
          created_at: string
        }
        Insert: {
          id?: string
          institute_id: string
          paper_id: string
          set_label: string
          copies_to_print?: number
          created_at?: string
        }
        Update: {
          id?: string
          institute_id?: string
          paper_id?: string
          set_label?: string
          copies_to_print?: number
          created_at?: string
        }
        Relationships: []
      }
      papers: {
        Row: {
          id: string
          institute_id: string
          teacher_id: string | null
          batch_id: string | null
          class_subject_id: string
          pattern_id: string | null
          title: string
          total_marks: number | null
          duration_min: number | null
          status: string
          seed: number | null
          generated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          institute_id: string
          teacher_id?: string | null
          batch_id?: string | null
          class_subject_id: string
          pattern_id?: string | null
          title: string
          total_marks?: number | null
          duration_min?: number | null
          status?: string
          seed?: number | null
          generated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          institute_id?: string
          teacher_id?: string | null
          batch_id?: string | null
          class_subject_id?: string
          pattern_id?: string | null
          title?: string
          total_marks?: number | null
          duration_min?: number | null
          status?: string
          seed?: number | null
          generated_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      pattern_sections: {
        Row: {
          id: string
          pattern_id: string
          owner_institute_id: string
          label: string
          sort_order: number
          instructions: string | null
          question_count: number
          marks_each: number
          question_types: string[]
          allow_choice: boolean
          practice_eligible: boolean
          requires_stimulus: boolean
        }
        Insert: {
          id?: string
          pattern_id: string
          owner_institute_id: string
          label: string
          sort_order?: number
          instructions?: string | null
          question_count: number
          marks_each: number
          question_types?: string[]
          allow_choice?: boolean
          practice_eligible?: boolean
          requires_stimulus?: boolean
        }
        Update: {
          id?: string
          pattern_id?: string
          owner_institute_id?: string
          label?: string
          sort_order?: number
          instructions?: string | null
          question_count?: number
          marks_each?: number
          question_types?: string[]
          allow_choice?: boolean
          practice_eligible?: boolean
          requires_stimulus?: boolean
        }
        Relationships: []
      }
      platform_access_log: {
        Row: {
          id: string
          actor: string | null
          institute_id: string | null
          action: string
          target_table: string | null
          target_id: string | null
          at: string
        }
        Insert: {
          id?: string
          actor?: string | null
          institute_id?: string | null
          action: string
          target_table?: string | null
          target_id?: string | null
          at?: string
        }
        Update: {
          id?: string
          actor?: string | null
          institute_id?: string | null
          action?: string
          target_table?: string | null
          target_id?: string | null
          at?: string
        }
        Relationships: []
      }
      practice_set_items: {
        Row: {
          id: string
          institute_id: string
          practice_set_id: string
          question_id: string
          position: number
          is_done: boolean
          self_marked_correct: boolean | null
        }
        Insert: {
          id?: string
          institute_id: string
          practice_set_id: string
          question_id: string
          position?: number
          is_done?: boolean
          self_marked_correct?: boolean | null
        }
        Update: {
          id?: string
          institute_id?: string
          practice_set_id?: string
          question_id?: string
          position?: number
          is_done?: boolean
          self_marked_correct?: boolean | null
        }
        Relationships: []
      }
      practice_sets: {
        Row: {
          id: string
          institute_id: string
          student_id: string
          attempt_id: string | null
          class_subject_id: string
          built_at: string
          status: string
        }
        Insert: {
          id?: string
          institute_id: string
          student_id: string
          attempt_id?: string | null
          class_subject_id: string
          built_at?: string
          status?: string
        }
        Update: {
          id?: string
          institute_id?: string
          student_id?: string
          attempt_id?: string | null
          class_subject_id?: string
          built_at?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      question_assets: {
        Row: {
          id: string
          owner_institute_id: string
          question_id: string
          storage_path: string
          kind: string | null
          width: number | null
          height: number | null
        }
        Insert: {
          id?: string
          owner_institute_id: string
          question_id: string
          storage_path: string
          kind?: string | null
          width?: number | null
          height?: number | null
        }
        Update: {
          id?: string
          owner_institute_id?: string
          question_id?: string
          storage_path?: string
          kind?: string | null
          width?: number | null
          height?: number | null
        }
        Relationships: []
      }
      question_exposure: {
        Row: {
          institute_id: string
          student_id: string
          question_id: string
          first_seen_at: string
          context: string | null
        }
        Insert: {
          institute_id: string
          student_id: string
          question_id: string
          first_seen_at?: string
          context?: string | null
        }
        Update: {
          institute_id?: string
          student_id?: string
          question_id?: string
          first_seen_at?: string
          context?: string | null
        }
        Relationships: []
      }
      question_flags: {
        Row: {
          id: string
          institute_id: string
          question_id: string
          raised_by: string | null
          reason: string | null
          status: string
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          institute_id: string
          question_id: string
          raised_by?: string | null
          reason?: string | null
          status?: string
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          institute_id?: string
          question_id?: string
          raised_by?: string | null
          reason?: string | null
          status?: string
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          owner_institute_id: string
          class_subject_id: string
          chapter_id: string | null
          topic_id: string | null
          strand_id: string | null
          stimulus_id: string | null
          parent_question_id: string | null
          part_label: string | null
          body: string
          question_type: string
          options: Json | null
          correct_option: string | null
          answer: string | null
          numeric_answer: number | null
          tolerance: number | null
          solution: string | null
          rubric: string | null
          marks: number
          difficulty: string
          language: string
          source: string | null
          source_year: number | null
          status: string
          options_shufflable: boolean
          position_locked: boolean
          body_hash: string | null
          body_normalised: string | null
          search_tsv: unknown | null
          tsv_config: string | null
          note: string | null
          created_at: string
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          id?: string
          owner_institute_id: string
          class_subject_id: string
          chapter_id?: string | null
          topic_id?: string | null
          strand_id?: string | null
          stimulus_id?: string | null
          parent_question_id?: string | null
          part_label?: string | null
          body: string
          question_type: string
          options?: Json | null
          correct_option?: string | null
          answer?: string | null
          numeric_answer?: number | null
          tolerance?: number | null
          solution?: string | null
          rubric?: string | null
          marks?: number
          difficulty?: string
          language?: string
          source?: string | null
          source_year?: number | null
          status?: string
          options_shufflable?: boolean
          position_locked?: boolean
          body_hash?: string | null
          body_normalised?: string | null
          search_tsv?: unknown | null
          tsv_config?: string | null
          note?: string | null
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          id?: string
          owner_institute_id?: string
          class_subject_id?: string
          chapter_id?: string | null
          topic_id?: string | null
          strand_id?: string | null
          stimulus_id?: string | null
          parent_question_id?: string | null
          part_label?: string | null
          body?: string
          question_type?: string
          options?: Json | null
          correct_option?: string | null
          answer?: string | null
          numeric_answer?: number | null
          tolerance?: number | null
          solution?: string | null
          rubric?: string | null
          marks?: number
          difficulty?: string
          language?: string
          source?: string | null
          source_year?: number | null
          status?: string
          options_shufflable?: boolean
          position_locked?: boolean
          body_hash?: string | null
          body_normalised?: string | null
          search_tsv?: unknown | null
          tsv_config?: string | null
          note?: string | null
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Relationships: []
      }
      role_audit: {
        Row: {
          id: string
          institute_id: string
          actor: string | null
          target: string | null
          old_role: string | null
          new_role: string | null
          at: string
        }
        Insert: {
          id?: string
          institute_id: string
          actor?: string | null
          target?: string | null
          old_role?: string | null
          new_role?: string | null
          at?: string
        }
        Update: {
          id?: string
          institute_id?: string
          actor?: string | null
          target?: string | null
          old_role?: string | null
          new_role?: string | null
          at?: string
        }
        Relationships: []
      }
      stimuli: {
        Row: {
          id: string
          owner_institute_id: string
          class_subject_id: string
          kind: string
          body: string | null
          asset_id: string | null
          language: string
          source: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_institute_id: string
          class_subject_id: string
          kind: string
          body?: string | null
          asset_id?: string | null
          language?: string
          source?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_institute_id?: string
          class_subject_id?: string
          kind?: string
          body?: string | null
          asset_id?: string | null
          language?: string
          source?: string | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      strands: {
        Row: {
          id: string
          class_subject_id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          class_subject_id: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          class_subject_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      subjects: {
        Row: {
          id: string
          name: string
          short_name: string | null
          script: string
        }
        Insert: {
          id?: string
          name: string
          short_name?: string | null
          script?: string
        }
        Update: {
          id?: string
          name?: string
          short_name?: string | null
          script?: string
        }
        Relationships: []
      }
      teacher_subjects: {
        Row: {
          institute_id: string
          teacher_id: string
          class_subject_id: string
          created_at: string
        }
        Insert: {
          institute_id: string
          teacher_id: string
          class_subject_id: string
          created_at?: string
        }
        Update: {
          institute_id?: string
          teacher_id?: string
          class_subject_id?: string
          created_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          chapter_id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          chapter_id: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          chapter_id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      my_active_class_subjects: {
        Row: {
          institute_id: string | null
          class_subject_id: string | null
          class_name: string | null
          subject_name: string | null
          subject_short_name: string | null
          script: string | null
          bank_status: string | null
          role: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invite: {
        Args: {
          p_invite_id: string
        }
        Returns: undefined
      }
      batches_set_join_code: {
        Args: Record<string, never>
        Returns: unknown
      }
      block_marks: {
        Args: {
          p_block_id: string
        }
        Returns: number
      }
      can_access_paper: {
        Args: {
          p_paper_id: string
        }
        Returns: boolean
      }
      can_read_solution: {
        Args: {
          p_question_id: string
        }
        Returns: boolean
      }
      chapter_pool_counts: {
        Args: {
          p_institute_id: string
          p_class_subject_id: string
        }
        Returns: {
          chapter_id: string
          chapter_name: string
          sort_order: number
          approved: number
        }[]
      }
      create_institute: {
        Args: {
          p_name: string
          p_slug: string
          p_contact_email: string
          p_first_admin_email: string
        }
        Returns: string
      }
      decide_activation_request: {
        Args: {
          p_request_id: string
          p_approve: boolean
          p_reason?: string
        }
        Returns: undefined
      }
      eligible_questions: {
        Args: {
          p_institute_id: string
          p_class_subject_id: string
          p_chapter_ids?: unknown
          p_teacher_id?: string
          p_exclude_recent_papers?: number
        }
        Returns: {
          id: string
          owner_institute_id: string
          class_subject_id: string
          chapter_id: string
          topic_id: string
          strand_id: string
          stimulus_id: string
          parent_question_id: string
          part_label: string
          body: string
          question_type: string
          marks: number
          difficulty: string
          source: string
          options_shufflable: boolean
          position_locked: boolean
        }[]
      }
      generate_join_code: {
        Args: Record<string, never>
        Returns: string
      }
      get_question_solution: {
        Args: {
          p_question_id: string
        }
        Returns: {
          answer: string
          solution: string
          rubric: string
          correct_option: string
          numeric_answer: number
          tolerance: number
        }[]
      }
      handle_new_user: {
        Args: Record<string, never>
        Returns: unknown
      }
      is_platform_owner: {
        Args: Record<string, never>
        Returns: boolean
      }
      join_batch: {
        Args: {
          p_code: string
        }
        Returns: string
      }
      my_institutes: {
        Args: Record<string, never>
        Returns: string[]
      }
      my_pending_invites: {
        Args: Record<string, never>
        Returns: {
          id: string
          institute_id: string
          institute_name: string
          role: string
          created_at: string
        }[]
      }
      my_role: {
        Args: {
          inst: string
        }
        Returns: string
      }
      paper_of_set: {
        Args: {
          p_paper_set_id: string
        }
        Returns: string
      }
      paper_set_items_marks_guard: {
        Args: Record<string, never>
        Returns: unknown
      }
      peek_join_code: {
        Args: {
          p_code: string
        }
        Returns: {
          batch_id: string
          batch_name: string
          institute_id: string
          institute_name: string
          class_subject_id: string
          subject_name: string
          class_name: string
          already_enrolled_batch: string
        }[]
      }
      platform_inspect_institute: {
        Args: {
          p_institute_id: string
        }
        Returns: Json
      }
      platform_inspect_paper: {
        Args: {
          p_paper_id: string
        }
        Returns: Json
      }
      platform_institute_id: {
        Args: Record<string, never>
        Returns: string
      }
      questions_normalise: {
        Args: Record<string, never>
        Returns: unknown
      }
      questions_status_guard: {
        Args: Record<string, never>
        Returns: unknown
      }
      set_member_role: {
        Args: {
          p_institute_id: string
          p_target_email: string
          p_new_role: string
        }
        Returns: undefined
      }
      shares_institute: {
        Args: {
          target: string
        }
        Returns: boolean
      }
      teaches: {
        Args: {
          p_institute_id: string
          p_class_subject_id: string
        }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T];
