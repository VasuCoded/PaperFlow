-- ============================================================================
-- 0003 · PAPER PATTERNS
-- BUILD-PLAN section 5.2. Patterns are data, so a Class 10 Science board
-- pattern and a Class 11 Physics institute unit test are both expressible
-- without a code change. Board patterns are platform-owned and read by
-- everyone; an institute's own patterns are private to it.
-- ============================================================================

create table public.paper_patterns (
  id uuid primary key default gen_random_uuid(),
  owner_institute_id uuid not null references public.institutes (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  name text not null,
  total_marks int not null check (total_marks > 0),
  duration_min int check (duration_min > 0),
  origin text not null check (origin in ('board', 'institute')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  -- Referenced by pattern_sections' composite FK so a section cannot land in a
  -- different tenant from its pattern.
  unique (id, owner_institute_id)
);

create table public.pattern_sections (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null,
  owner_institute_id uuid not null,
  label text not null,
  sort_order int not null default 0,
  instructions text,
  question_count int not null check (question_count > 0),
  marks_each int not null check (marks_each > 0),
  question_types text[] not null default '{}',
  allow_choice boolean not null default false,
  practice_eligible boolean not null default true,
  requires_stimulus boolean not null default false,
  -- Composite FK: section's tenant must equal its pattern's tenant.
  foreign key (pattern_id, owner_institute_id)
    references public.paper_patterns (id, owner_institute_id) on delete cascade,
  unique (pattern_id, label)
);

-- ----------------------------------------------------------------------------
-- RLS. Read = shared (platform) OR owned by one of my institutes. Write:
-- platform owner for platform patterns; an institute_admin may manage patterns
-- owned by their OWN institute (unit-test structures; patterns are structure,
-- not answer keys, so they are not behind the question review gate).
-- ----------------------------------------------------------------------------
alter table public.paper_patterns enable row level security;
alter table public.pattern_sections enable row level security;

create policy paper_patterns_read on public.paper_patterns
  for select to authenticated
  using (
    owner_institute_id = public.platform_institute_id()
    or owner_institute_id in (select public.my_institutes())
  );

create policy paper_patterns_write_platform on public.paper_patterns
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy paper_patterns_write_institute on public.paper_patterns
  for all to authenticated
  using (
    origin = 'institute'
    and public.my_role(owner_institute_id) = 'institute_admin'
  )
  with check (
    origin = 'institute'
    and public.my_role(owner_institute_id) = 'institute_admin'
  );

create policy pattern_sections_read on public.pattern_sections
  for select to authenticated
  using (
    owner_institute_id = public.platform_institute_id()
    or owner_institute_id in (select public.my_institutes())
  );

create policy pattern_sections_write_platform on public.pattern_sections
  for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy pattern_sections_write_institute on public.pattern_sections
  for all to authenticated
  using (public.my_role(owner_institute_id) = 'institute_admin')
  with check (public.my_role(owner_institute_id) = 'institute_admin');

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop table if exists public.pattern_sections;
drop table if exists public.paper_patterns;
*/
