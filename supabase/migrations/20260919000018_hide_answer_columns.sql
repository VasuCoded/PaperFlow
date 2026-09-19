-- ============================================================================
-- 0018 · ACTUALLY HIDE THE ANSWER COLUMNS
--
-- Found on the first run against live Supabase. Migration 0004 did
--   revoke select (answer, solution, rubric, correct_option, numeric_answer,
--                  tolerance) on public.questions from authenticated, anon;
-- which has NO EFFECT: Supabase grants SELECT on every public table to
-- authenticated and anon, and in Postgres a column-level REVOKE cannot narrow
-- a table-level GRANT. Any signed-in student could read every answer in the
-- bank straight from the API (RLS limits rows, not columns).
--
-- The rule (CLAUDE.md: "No client-side query may return solution, answer or
-- rubric") needs the table grant removed and the SAFE columns granted back
-- one by one. Answers then reach a client only through
-- get_question_solution() (definer, gated on an attempt), and teachers' answer
-- keys only through the server-side service role.
--
-- Consequence: `select *` on questions now fails for client roles, and a new
-- column added to questions later is hidden until it is granted here. Both are
-- intended — hiding by default is the safe direction.
-- anon gets nothing: every questions policy is for authenticated only.
-- Writes are unchanged (INSERT/UPDATE/DELETE stay granted; RLS limits them to
-- the platform owner).
-- ============================================================================

revoke select on public.questions from anon, authenticated;

grant select (
  id,
  owner_institute_id,
  class_subject_id,
  chapter_id,
  topic_id,
  strand_id,
  stimulus_id,
  parent_question_id,
  part_label,
  body,
  question_type,
  options,
  marks,
  difficulty,
  language,
  source,
  source_year,
  status,
  options_shufflable,
  position_locked,
  body_hash,
  body_normalised,
  search_tsv,
  tsv_config,
  note,
  created_at,
  approved_at,
  approved_by
) on public.questions to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
-- Restores the leaky state; do not run in production.
grant select on public.questions to authenticated, anon;
*/
