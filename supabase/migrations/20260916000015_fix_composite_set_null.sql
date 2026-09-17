-- ============================================================================
-- 0015 · COMPOSITE FOREIGN KEYS MUST NOT NULL THE TENANT KEY
--
-- Found by the executable isolation suite (tests/db/isolation.test.ts).
--
-- Two composite FKs pin a child row's tenant to its parent's tenant:
--   papers        (batch_id,   institute_id) -> batches  (id, institute_id)
--   practice_sets (attempt_id, institute_id) -> attempts (id, institute_id)
-- Both were ON DELETE SET NULL. Without a column list, SET NULL nulls EVERY
-- referencing column, including institute_id, which is NOT NULL. So deleting
-- a batch that has papers, or an attempt that has a practice set, failed —
-- and had institute_id been nullable it would have orphaned the row from its
-- tenant, which is worse.
--
-- Postgres 15+ accepts a column list: null only the optional reference and
-- keep the tenant key. Supabase runs 15 or later.
-- ============================================================================

alter table public.papers drop constraint if exists papers_batch_fk;
alter table public.papers
  add constraint papers_batch_fk
  foreign key (batch_id, institute_id)
  references public.batches (id, institute_id)
  on delete set null (batch_id);

alter table public.practice_sets drop constraint if exists practice_sets_attempt_id_institute_id_fkey;
alter table public.practice_sets
  add constraint practice_sets_attempt_id_institute_id_fkey
  foreign key (attempt_id, institute_id)
  references public.attempts (id, institute_id)
  on delete set null (attempt_id);

-- ============================================================================
-- DOWN
-- ============================================================================
/*
alter table public.practice_sets drop constraint if exists practice_sets_attempt_id_institute_id_fkey;
alter table public.practice_sets
  add constraint practice_sets_attempt_id_institute_id_fkey
  foreign key (attempt_id, institute_id) references public.attempts (id, institute_id) on delete set null;
alter table public.papers drop constraint if exists papers_batch_fk;
alter table public.papers
  add constraint papers_batch_fk
  foreign key (batch_id, institute_id) references public.batches (id, institute_id) on delete set null;
*/
