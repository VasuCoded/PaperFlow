-- ============================================================================
-- 0007 · INDEXES
-- BUILD-PLAN section 5.6. Every tenant-scoped index leads with the tenant key.
-- A policy that filters on institute_id with an index that does not lead with
-- it is how the first slow query happens.
-- ============================================================================

-- Bank: the generator's eligible-pool query and duplicate detection.
create index questions_pool_idx on public.questions
  (owner_institute_id, status, class_subject_id, chapter_id, difficulty, marks);

create index questions_approved_idx on public.questions
  (owner_institute_id, class_subject_id) where status = 'approved';

create index questions_search_tsv_idx on public.questions using gin (search_tsv);

create index questions_body_trgm_idx on public.questions
  using gin (body_normalised gin_trgm_ops);

create index questions_stimulus_idx on public.questions (stimulus_id)
  where stimulus_id is not null;

create index questions_parent_idx on public.questions (parent_question_id)
  where parent_question_id is not null;

-- Activity.
create index attempt_items_q_idx on public.attempt_items (institute_id, question_id);
create index attempt_items_attempt_idx on public.attempt_items (institute_id, attempt_id);
create index attempts_student_idx on public.attempts (institute_id, student_id, paper_id);
create index question_exposure_idx on public.question_exposure
  (institute_id, student_id, question_id);
create index practice_set_items_set_idx on public.practice_set_items
  (institute_id, practice_set_id);
create index practice_sets_student_idx on public.practice_sets
  (institute_id, student_id, class_subject_id);

-- Papers and sets.
create index paper_set_items_idx on public.paper_set_items
  (institute_id, paper_set_id, display_position);
create index paper_blocks_paper_idx on public.paper_blocks (institute_id, paper_id);
create index paper_questions_paper_idx on public.paper_questions (institute_id, paper_id);
create index paper_questions_block_idx on public.paper_questions (block_id);
create index papers_batch_idx on public.papers (institute_id, batch_id);
create index papers_cs_idx on public.papers (institute_id, class_subject_id);

-- Taxonomy and membership.
create index chapters_cs_idx on public.chapters (class_subject_id, sort_order);
create index topics_chapter_idx on public.topics (chapter_id);
create index institute_members_user_idx on public.institute_members (user_id);
create index ics_status_idx on public.institute_class_subjects (institute_id, status);
create index teacher_subjects_teacher_idx on public.teacher_subjects
  (institute_id, teacher_id);
create index enrolments_student_idx on public.enrolments (institute_id, student_id);
create index activation_requests_inst_idx on public.activation_requests
  (institute_id, status);

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop index if exists public.activation_requests_inst_idx;
drop index if exists public.enrolments_student_idx;
drop index if exists public.teacher_subjects_teacher_idx;
drop index if exists public.ics_status_idx;
drop index if exists public.institute_members_user_idx;
drop index if exists public.topics_chapter_idx;
drop index if exists public.chapters_cs_idx;
drop index if exists public.papers_cs_idx;
drop index if exists public.papers_batch_idx;
drop index if exists public.paper_questions_block_idx;
drop index if exists public.paper_questions_paper_idx;
drop index if exists public.paper_blocks_paper_idx;
drop index if exists public.paper_set_items_idx;
drop index if exists public.practice_sets_student_idx;
drop index if exists public.practice_set_items_set_idx;
drop index if exists public.question_exposure_idx;
drop index if exists public.attempts_student_idx;
drop index if exists public.attempt_items_attempt_idx;
drop index if exists public.attempt_items_q_idx;
drop index if exists public.questions_parent_idx;
drop index if exists public.questions_stimulus_idx;
drop index if exists public.questions_body_trgm_idx;
drop index if exists public.questions_search_tsv_idx;
drop index if exists public.questions_approved_idx;
drop index if exists public.questions_pool_idx;
*/
