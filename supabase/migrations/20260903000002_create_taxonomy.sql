-- ============================================================================
-- 0002 · TAXONOMY
-- BUILD-PLAN section 5.1. Global reference tables (classes, subjects,
-- class_subjects, strands, chapters, topics) carry NO tenant key — readable by
-- every authenticated user, writable by platform_owner only.
-- institute_class_subjects is per-tenant activation over a platform bank_status.
-- ============================================================================

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- '9', '10', '11', '12'
  sort_order int not null default 0
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  script text not null default 'latin' check (script in ('latin', 'devanagari')),
  unique (name)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  bank_status text not null default 'planned'
    check (bank_status in ('planned', 'seeding', 'ready')),
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

-- Social Science, classes 9-10, is one subject with four strands. Classes
-- 11-12 use separate subjects. Both are expressed by this table without a
-- special case in the query layer: a class_subject simply has zero or more
-- strands.
create table public.strands (
  id uuid primary key default gen_random_uuid(),
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  unique (class_subject_id, name)
);

-- Chapters hang off class_subjects, not subjects (5.1): Class 11 Physics and
-- Class 12 Physics are different offerings with different chapters.
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  strand_id uuid references public.strands (id) on delete set null,
  name text not null,
  ncert_number text,
  sort_order int not null default 0,
  unique (class_subject_id, name)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  name text not null,
  slug text not null,
  unique (chapter_id, slug)
);

-- Per-tenant activation. status is independent of class_subjects.bank_status:
-- one is "how thick the shared bank is" (platform), the other is "does this
-- institute have it turned on" (tenant). Never collapse them (5.1).
create table public.institute_class_subjects (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  status text not null default 'planned' check (status in ('planned', 'active')),
  activated_at timestamptz,
  activated_by uuid references auth.users (id),
  primary key (institute_id, class_subject_id)
);

-- ----------------------------------------------------------------------------
-- The one view used everywhere for "what can this person see" (5.1). Keyed off
-- auth.uid(), tenant-aware in exactly one place. security_invoker so the
-- caller's RLS applies through it. No application code filters status by hand.
-- ----------------------------------------------------------------------------
create view public.my_active_class_subjects
with (security_invoker = true)
as
  select
    m.institute_id,
    ics.class_subject_id,
    cl.name as class_name,
    s.name as subject_name,
    s.short_name as subject_short_name,
    s.script,
    cs.bank_status,
    m.role
  from public.institute_members m
  join public.institute_class_subjects ics
    on ics.institute_id = m.institute_id and ics.status = 'active'
  join public.class_subjects cs on cs.id = ics.class_subject_id
  join public.classes cl on cl.id = cs.class_id
  join public.subjects s on s.id = cs.subject_id
  where m.user_id = auth.uid();

-- ----------------------------------------------------------------------------
-- RLS. Global tables: read by all authenticated, write by platform owner.
-- ----------------------------------------------------------------------------
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.strands enable row level security;
alter table public.chapters enable row level security;
alter table public.topics enable row level security;
alter table public.institute_class_subjects enable row level security;

-- Reusable pattern for the six global reference tables.
create policy classes_read on public.classes
  for select to authenticated using (true);
create policy classes_write on public.classes
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy subjects_read on public.subjects
  for select to authenticated using (true);
create policy subjects_write on public.subjects
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy class_subjects_read on public.class_subjects
  for select to authenticated using (true);
create policy class_subjects_write on public.class_subjects
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy strands_read on public.strands
  for select to authenticated using (true);
create policy strands_write on public.strands
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy chapters_read on public.chapters
  for select to authenticated using (true);
create policy chapters_write on public.chapters
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy topics_read on public.topics
  for select to authenticated using (true);
create policy topics_write on public.topics
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

-- institute_class_subjects: tenant-scoped. Members of an institute read their
-- own activation state; only the platform owner writes it (activation is gated
-- on bank coverage, which a tenant admin cannot evaluate — 4.4 step 6).
create policy ics_read on public.institute_class_subjects
  for select to authenticated
  using (institute_id in (select public.my_institutes()));
create policy ics_write_platform on public.institute_class_subjects
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop view if exists public.my_active_class_subjects;
drop table if exists public.institute_class_subjects;
drop table if exists public.topics;
drop table if exists public.chapters;
drop table if exists public.strands;
drop table if exists public.class_subjects;
drop table if exists public.subjects;
drop table if exists public.classes;
*/
