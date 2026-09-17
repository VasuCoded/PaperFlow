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
        Relationships: [
          {
            foreignKeyName: "activation_requests_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_requests_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "attempt_items_attempt_id_institute_id_fkey"
            columns: ["attempt_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "attempt_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "attempts_paper_id_institute_id_fkey"
            columns: ["paper_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "attempts_paper_set_id_institute_id_fkey"
            columns: ["paper_set_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "paper_sets"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "batches_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "chapters_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "strands"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "coverage_gaps_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_gaps_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_gaps_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "enrolments_batch_id_institute_id_fkey"
            columns: ["batch_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "enrolments_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      generation_events: {
        Row: {
          id: number
          institute_id: string
          user_id: string
          kind: string
          at: string
        }
        Insert: {
          id?: number
          institute_id: string
          user_id: string
          kind: string
          at?: string
        }
        Update: {
          id?: number
          institute_id?: string
          user_id?: string
          kind?: string
          at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_events_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "institute_class_subjects_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_class_subjects_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_class_subjects_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "institute_invites_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "institute_members_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institute_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "institutes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "paper_blocks_paper_id_institute_id_fkey"
            columns: ["paper_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "paper_blocks_section_id_institute_id_fkey"
            columns: ["section_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "paper_sections"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "paper_blocks_stimulus_id_fkey"
            columns: ["stimulus_id"]
            isOneToOne: false
            referencedRelation: "stimuli"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "paper_patterns_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_patterns_owner_institute_id_fkey"
            columns: ["owner_institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "paper_questions_block_id_institute_id_fkey"
            columns: ["block_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "paper_blocks"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "paper_questions_paper_id_institute_id_fkey"
            columns: ["paper_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "paper_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "paper_sections_paper_id_institute_id_fkey"
            columns: ["paper_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "paper_sections_pattern_section_id_fkey"
            columns: ["pattern_section_id"]
            isOneToOne: false
            referencedRelation: "pattern_sections"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "paper_set_items_paper_block_id_institute_id_fkey"
            columns: ["paper_block_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "paper_blocks"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "paper_set_items_paper_set_id_institute_id_fkey"
            columns: ["paper_set_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "paper_sets"
            referencedColumns: ["id", "institute_id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "paper_set_options_paper_question_id_institute_id_fkey"
            columns: ["paper_question_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "paper_questions"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "paper_set_options_paper_set_id_institute_id_fkey"
            columns: ["paper_set_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "paper_sets"
            referencedColumns: ["id", "institute_id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "paper_sets_paper_id_institute_id_fkey"
            columns: ["paper_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id", "institute_id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "papers_batch_fk"
            columns: ["batch_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "papers_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "papers_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "papers_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "paper_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "papers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "pattern_sections_pattern_id_owner_institute_id_fkey"
            columns: ["pattern_id", "owner_institute_id"]
            isOneToOne: false
            referencedRelation: "paper_patterns"
            referencedColumns: ["id", "owner_institute_id"]
          }
        ]
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
          detail: string | null
        }
        Insert: {
          id?: string
          actor?: string | null
          institute_id?: string | null
          action: string
          target_table?: string | null
          target_id?: string | null
          at?: string
          detail?: string | null
        }
        Update: {
          id?: string
          actor?: string | null
          institute_id?: string | null
          action?: string
          target_table?: string | null
          target_id?: string | null
          at?: string
          detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_access_log_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_access_log_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "practice_set_items_practice_set_id_institute_id_fkey"
            columns: ["practice_set_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "practice_sets"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "practice_set_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "practice_sets_attempt_id_institute_id_fkey"
            columns: ["attempt_id", "institute_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id", "institute_id"]
          },
          {
            foreignKeyName: "practice_sets_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "question_assets_question_id_owner_institute_id_fkey"
            columns: ["question_id", "owner_institute_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id", "owner_institute_id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "question_exposure_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_exposure_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_exposure_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "question_flags_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_flags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_flags_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "questions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_owner_institute_id_fkey"
            columns: ["owner_institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_parent_question_id_fkey"
            columns: ["parent_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_stimulus_id_fkey"
            columns: ["stimulus_id"]
            isOneToOne: false
            referencedRelation: "stimuli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "strands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "role_audit_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_audit_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_audit_target_fkey"
            columns: ["target"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "stimuli_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimuli_owner_institute_id_fkey"
            columns: ["owner_institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "strands_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          }
        ]
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
      class_subject_label: {
        Args: {
          p_class_subject_id: string
        }
        Returns: string
      }
      correct_attempt_set: {
        Args: {
          p_attempt_id: string
          p_correct_set_id: string
        }
        Returns: undefined
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
      institute_subject_overview: {
        Args: {
          p_institute_id: string
        }
        Returns: {
          class_subject_id: string
          class_name: string
          subject_name: string
          bank_status: string
          approved_shared: number
          approved_private: number
          status: string
          pending_request: boolean
          last_decline_reason: string
          last_declined_at: string
        }[]
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
      log_attempt: {
        Args: {
          p_paper_id: string
          p_paper_set_id?: string
          p_wrong_positions?: unknown
        }
        Returns: string
      }
      log_institute_export: {
        Args: {
          p_institute_id: string
        }
        Returns: undefined
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
      my_suspended_institutes: {
        Args: Record<string, never>
        Returns: {
          institute_id: string
          institute_name: string
          role: string
        }[]
      }
      note_generation: {
        Args: {
          p_institute_id: string
          p_kind: string
        }
        Returns: undefined
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
      platform_activation_requests: {
        Args: Record<string, never>
        Returns: {
          id: string
          institute_id: string
          institute_name: string
          class_subject_id: string
          class_subject_label: string
          requested_by_email: string
          status: string
          reason: string
          created_at: string
          decided_at: string
        }[]
      }
      platform_audit: {
        Args: {
          p_institute_id?: string
          p_limit?: number
        }
        Returns: {
          kind: string
          at: string
          actor_email: string
          institute_id: string
          institute_name: string
          action: string
          target: string
        }[]
      }
      platform_bank_coverage: {
        Args: Record<string, never>
        Returns: {
          class_subject_id: string
          label: string
          bank_status: string
          approved: number
          staging: number
          chapters: number
          thinnest_chapter: string
          thinnest_chapter_count: number
          thinnest_topic_count: number
        }[]
      }
      platform_correct_attempt_set: {
        Args: {
          p_attempt_id: string
          p_correct_set_id: string
          p_reason: string
        }
        Returns: undefined
      }
      platform_guard: {
        Args: Record<string, never>
        Returns: undefined
      }
      platform_health: {
        Args: Record<string, never>
        Returns: Json
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
      platform_invite: {
        Args: {
          p_institute_id: string
          p_email: string
          p_role: string
        }
        Returns: string
      }
      platform_list_institutes: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          slug: string
          status: string
          contact_email: string
          created_at: string
          admins: number
          teachers: number
          students: number
          active_subjects: number
          papers: number
          last_activity: string
        }[]
      }
      platform_list_invites: {
        Args: {
          p_institute_id: string
        }
        Returns: {
          id: string
          email: string
          role: string
          created_at: string
        }[]
      }
      platform_move_student: {
        Args: {
          p_institute_id: string
          p_student_id: string
          p_to_batch_id: string
          p_reason: string
        }
        Returns: undefined
      }
      platform_open_flags: {
        Args: {
          p_limit?: number
        }
        Returns: {
          id: string
          institute_id: string
          institute_name: string
          question_id: string
          question_owner_name: string
          is_private: boolean
          class_subject_label: string
          body: string
          question_status: string
          reason: string
          raised_by_email: string
          created_at: string
          open_on_question: number
        }[]
      }
      platform_require_reason: {
        Args: {
          p_reason: string
        }
        Returns: string
      }
      platform_resolve_flag: {
        Args: {
          p_flag_id: string
          p_status: string
          p_note: string
        }
        Returns: undefined
      }
      platform_retire_question: {
        Args: {
          p_question_id: string
          p_reason: string
        }
        Returns: undefined
      }
      platform_review_question: {
        Args: {
          p_question_id: string
          p_decision: string
          p_promote_to_shared?: boolean
        }
        Returns: undefined
      }
      platform_review_queue: {
        Args: {
          p_limit?: number
        }
        Returns: {
          id: string
          owner_institute_id: string
          owner_name: string
          is_private: boolean
          class_subject_id: string
          class_subject_label: string
          chapter_name: string
          body: string
          options: Json
          answer: string
          correct_option: string
          marks: number
          difficulty: string
          source: string
          note: string
          created_at: string
        }[]
      }
      platform_revoke_invite: {
        Args: {
          p_invite_id: string
        }
        Returns: undefined
      }
      platform_set_activation: {
        Args: {
          p_institute_id: string
          p_class_subject_id: string
          p_active: boolean
        }
        Returns: undefined
      }
      platform_set_institute_status: {
        Args: {
          p_institute_id: string
          p_status: string
        }
        Returns: undefined
      }
      platform_support_lookup: {
        Args: {
          p_email: string
        }
        Returns: Json
      }
      questions_normalise: {
        Args: Record<string, never>
        Returns: unknown
      }
      questions_status_guard: {
        Args: Record<string, never>
        Returns: unknown
      }
      remap_attempt_set_internal: {
        Args: {
          p_attempt_id: string
          p_correct_set_id: string
        }
        Returns: boolean
      }
      remove_member: {
        Args: {
          p_institute_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      rotate_join_code: {
        Args: {
          p_batch_id: string
        }
        Returns: string
      }
      save_practice_set: {
        Args: {
          p_attempt_id: string
          p_items: Json
          p_gaps?: Json
        }
        Returns: string
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
      withdraw_flag: {
        Args: {
          p_flag_id: string
        }
        Returns: undefined
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
