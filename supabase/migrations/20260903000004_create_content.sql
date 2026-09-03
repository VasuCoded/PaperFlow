-- ============================================================================
-- 0004 · CONTENT (the bank)
-- BUILD-PLAN section 5.3. owner_institute_id is the platform institute for
-- shared questions and a tenant for private ones. One read predicate,
-- identical everywhere. Bank WRITES are platform_owner only (5.7 rule 4).
-- ============================================================================

create table public.stimuli (
  id uuid primary key default gen_random_uuid(),
  owner_institute_id uuid not null references public.institutes (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  kind text not null check (kind in
    ('passage', 'case_study', 'source_extract', 'map', 'data_table', 'diagram')),
  body text,
  asset_id uuid,
  language text not null default 'en',
  source text,
  status text not null default 'staging'
    check (status in ('staging', 'approved', 'rejected', 'flagged', 'retired')),
  created_at timestamptz not null default now(),
  unique (id, owner_institute_id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  owner_institute_id uuid not null references public.institutes (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  strand_id uuid references public.strands (id) on delete set null,
  stimulus_id uuid references public.stimuli (id) on delete set null, -- null = standalone
  parent_question_id uuid references public.questions (id) on delete set null,
  part_label text,                        -- '(a)', '(b)', '(c)' for multi-part
  body text not null,
  question_type text not null,
  options jsonb,
  correct_option text,
  answer text,
  numeric_answer numeric,
  tolerance numeric,
  solution text,
  rubric text,
  marks int not null default 1 check (marks > 0),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  language text not null default 'en',
  source text,
  source_year int,
  status text not null default 'staging'
    check (status in ('staging', 'approved', 'rejected', 'flagged', 'retired')),
  options_shufflable boolean not null default false,
  position_locked boolean not null default false,
  body_hash text,
  body_normalised text,
  search_tsv tsvector,
  tsv_config text,
  note text,                              -- ingestion-session note (uncertainty)
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  unique (id, owner_institute_id)
);

create table public.question_assets (
  id uuid primary key default gen_random_uuid(),
  owner_institute_id uuid not null,
  question_id uuid not null,
  storage_path text not null,
  kind text,
  width int,
  height int,
  foreign key (question_id, owner_institute_id)
    references public.questions (id, owner_institute_id) on delete cascade
);

-- A flag is raised BY a tenant ABOUT a question (5.3). institute_id is the
-- flagging tenant, not the question owner. Institute A must not see that
-- institute B flagged something. A flag never changes the question's status.
create table public.question_flags (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  raised_by uuid references auth.users (id),
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Text handling (5.3, 2.2). body_normalised = NFC + whitespace-collapsed,
-- used for hashing and trigram duplicate detection. search_tsv uses 'english'
-- for latin rows and 'simple' for devanagari (never 'english' on Hindi), the
-- choice stored in tsv_config.
-- ----------------------------------------------------------------------------
create or replace function public.questions_normalise()
returns trigger language plpgsql set search_path = public
as $$
declare
  v_script text;
begin
  new.body_normalised := trim(regexp_replace(normalize(new.body, NFC), '\s+', ' ', 'g'));
  new.body_hash := encode(digest(new.body_normalised, 'sha256'), 'hex');

  select s.script into v_script
  from public.class_subjects cs
  join public.subjects s on s.id = cs.subject_id
  where cs.id = new.class_subject_id;

  new.tsv_config := case when v_script = 'devanagari' then 'simple' else 'english' end;
  new.search_tsv := to_tsvector(new.tsv_config::regconfig, coalesce(new.body_normalised, ''));

  return new;
end;
$$;

create trigger questions_normalise_biu
  before insert or update of body, class_subject_id on public.questions
  for each row execute function public.questions_normalise();

-- Ingestion guardrail (C3): everything lands as 'staging'. Nothing an
-- ingestion session inserts is ever 'approved'. Approval is a separate UPDATE
-- by the platform owner, which stamps approved_at/approved_by.
create or replace function public.questions_status_guard()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'staging';
    new.approved_at := null;
    new.approved_by := null;
  elsif tg_op = 'UPDATE' then
    if new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger questions_status_guard_biu
  before insert or update on public.questions
  for each row execute function public.questions_status_guard();

-- ----------------------------------------------------------------------------
-- RLS. Read = the single predicate (5.3). Write = platform owner only, for
-- BOTH the shared bank and institute-private questions (5.7 rule 4). Teachers
-- and institute admins may insert question_flags and nothing else.
-- ----------------------------------------------------------------------------
alter table public.stimuli enable row level security;
alter table public.questions enable row level security;
alter table public.question_assets enable row level security;
alter table public.question_flags enable row level security;

create policy stimuli_read on public.stimuli
  for select to authenticated
  using (
    owner_institute_id = public.platform_institute_id()
    or owner_institute_id in (select public.my_institutes())
  );
create policy stimuli_write_platform on public.stimuli
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy questions_read on public.questions
  for select to authenticated
  using (
    owner_institute_id = public.platform_institute_id()
    or owner_institute_id in (select public.my_institutes())
  );
create policy questions_write_platform on public.questions
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy question_assets_read on public.question_assets
  for select to authenticated
  using (
    owner_institute_id = public.platform_institute_id()
    or owner_institute_id in (select public.my_institutes())
  );
create policy question_assets_write_platform on public.question_assets
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

-- Flags: an institute's teachers and admins raise flags for their own
-- institute; they read only their own institute's flags. Platform owner reads
-- flags on shared questions via an audited inspect function (5.8), not here.
create policy question_flags_read on public.question_flags
  for select to authenticated
  using (institute_id in (select public.my_institutes()));

create policy question_flags_insert on public.question_flags
  for insert to authenticated
  with check (
    public.my_role(institute_id) in ('teacher', 'institute_admin')
    and raised_by = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- Column-level protection for solution/answer/rubric (5.7 rule 3, CLAUDE.md
-- "No client-side query may return solution, answer or rubric"). Revoke direct
-- read of these columns from client roles; they are returned only through
-- get_question_solution() (defined in the rls migration) after the attempt
-- gate, or server-side via the service role for teacher answer keys.
-- ----------------------------------------------------------------------------
revoke select (answer, solution, rubric, correct_option, numeric_answer, tolerance)
  on public.questions from authenticated, anon;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
grant select on public.questions to authenticated, anon;
drop table if exists public.question_flags;
drop table if exists public.question_assets;
drop trigger if exists questions_status_guard_biu on public.questions;
drop function if exists public.questions_status_guard();
drop trigger if exists questions_normalise_biu on public.questions;
drop function if exists public.questions_normalise();
drop table if exists public.questions;
drop table if exists public.stimuli;
*/
