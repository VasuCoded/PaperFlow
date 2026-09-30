-- ============================================================================
-- Figures for questions (graphs, diagrams).
--
-- Files live in a PRIVATE storage bucket. Nobody reads the bucket directly:
-- the app serves each figure through /asset/<id>, which first reads the
-- question_assets row with the viewer's own client (so the existing
-- question_assets_read policy decides: shared-bank figures for everyone signed
-- in, an institute's own figures for its members only) and only then fetches
-- the file with the service role.
--
-- A question shows a figure where its body contains the marker [[fig:<asset id>]]
-- (see renderRich), so every screen that renders a question shows its figures.
-- Only the platform owner attaches figures (question_assets_write_platform).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-assets', 'question-assets', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create index if not exists question_assets_question_idx on public.question_assets (question_id);

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop index if exists public.question_assets_question_idx;
delete from storage.buckets where id = 'question-assets';
*/
