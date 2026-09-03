-- ============================================================================
-- 0005 · PAPERS, BLOCKS AND SETS
-- BUILD-PLAN sections 5.4 and 3.2. A standalone question is a block of one; a
-- passage with eight questions is a block of eight. Selection, shuffling and
-- printing all operate on blocks. Every table is tenant-scoped with
-- institute_id; children agree with their parent via composite FKs.
--
-- RLS is ENABLED here (deny-by-default) but the policies live in the rls
-- migration (0008) because paper visibility depends on enrolments and
-- teacher_subjects, which are created in 0006. See CLAUDE.md note in that file.
-- ============================================================================

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  teacher_id uuid references auth.users (id),
  batch_id uuid,                       -- FK added in 0006 once batches exists
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  pattern_id uuid references public.paper_patterns (id),
  title text not null,
  total_marks int,
  duration_min int,
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'printed', 'archived')),
  seed bigint,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, institute_id)
);

create table public.paper_sections (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  paper_id uuid not null,
  pattern_section_id uuid references public.pattern_sections (id),
  label text not null,
  sort_order int not null default 0,
  foreign key (paper_id, institute_id)
    references public.papers (id, institute_id) on delete cascade,
  unique (id, institute_id)
);

create table public.paper_blocks (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  paper_id uuid not null,
  section_id uuid not null,
  canonical_position int not null,
  stimulus_id uuid references public.stimuli (id),
  locked boolean not null default false,
  foreign key (paper_id, institute_id)
    references public.papers (id, institute_id) on delete cascade,
  foreign key (section_id, institute_id)
    references public.paper_sections (id, institute_id) on delete cascade,
  unique (id, institute_id),
  unique (paper_id, canonical_position)
);

create table public.paper_questions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  paper_id uuid not null,
  block_id uuid not null,
  question_id uuid not null references public.questions (id),
  within_block_order int not null default 0,
  marks int not null check (marks > 0),
  is_choice_alternative boolean not null default false,
  foreign key (paper_id, institute_id)
    references public.papers (id, institute_id) on delete cascade,
  foreign key (block_id, institute_id)
    references public.paper_blocks (id, institute_id) on delete cascade,
  unique (id, institute_id)
);

create table public.paper_sets (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  paper_id uuid not null,
  set_label text not null,
  copies_to_print int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (paper_id, institute_id)
    references public.papers (id, institute_id) on delete cascade,
  unique (id, institute_id),
  unique (paper_id, set_label)
);

create table public.paper_set_items (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  paper_set_id uuid not null,
  paper_block_id uuid not null,
  display_position int not null,
  foreign key (paper_set_id, institute_id)
    references public.paper_sets (id, institute_id) on delete cascade,
  foreign key (paper_block_id, institute_id)
    references public.paper_blocks (id, institute_id) on delete cascade,
  unique (id, institute_id),
  unique (paper_set_id, display_position)
);

create table public.paper_set_options (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  paper_set_id uuid not null,
  paper_question_id uuid not null,
  option_order text[] not null,
  foreign key (paper_set_id, institute_id)
    references public.paper_sets (id, institute_id) on delete cascade,
  foreign key (paper_question_id, institute_id)
    references public.paper_questions (id, institute_id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- Marks-per-position invariant (3.1). For a given paper, every display_position
-- must carry the same marks value across all paper_sets — this is what keeps
-- the teacher's marking column identical across sets. A block's marks is the
-- sum of its non-choice-alternative questions. Enforced as a trigger that fails
-- loudly at insert, NOT as a convention.
-- ----------------------------------------------------------------------------
create or replace function public.block_marks(p_block_id uuid)
returns int language sql stable set search_path = public
as $$
  select coalesce(sum(marks), 0)::int
  from public.paper_questions
  where block_id = p_block_id and is_choice_alternative = false
$$;

create or replace function public.paper_set_items_marks_guard()
returns trigger language plpgsql set search_path = public
as $$
declare
  v_paper uuid;
  v_new_marks int;
begin
  select paper_id into v_paper from public.paper_sets where id = new.paper_set_id;
  v_new_marks := public.block_marks(new.paper_block_id);

  if exists (
    select 1
    from public.paper_set_items psi
    join public.paper_sets ps on ps.id = psi.paper_set_id
    where ps.paper_id = v_paper
      and psi.display_position = new.display_position
      and psi.id <> new.id
      and public.block_marks(psi.paper_block_id) <> v_new_marks
  ) then
    raise exception
      'marks-per-position violated: display_position % on paper % would carry % marks, differs from another set',
      new.display_position, v_paper, v_new_marks;
  end if;

  return new;
end;
$$;

create trigger paper_set_items_marks_guard_biu
  before insert or update on public.paper_set_items
  for each row execute function public.paper_set_items_marks_guard();

-- Enable RLS everywhere (deny-by-default until policies land in 0008).
alter table public.papers enable row level security;
alter table public.paper_sections enable row level security;
alter table public.paper_blocks enable row level security;
alter table public.paper_questions enable row level security;
alter table public.paper_sets enable row level security;
alter table public.paper_set_items enable row level security;
alter table public.paper_set_options enable row level security;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop trigger if exists paper_set_items_marks_guard_biu on public.paper_set_items;
drop function if exists public.paper_set_items_marks_guard();
drop function if exists public.block_marks(uuid);
drop table if exists public.paper_set_options;
drop table if exists public.paper_set_items;
drop table if exists public.paper_sets;
drop table if exists public.paper_questions;
drop table if exists public.paper_blocks;
drop table if exists public.paper_sections;
drop table if exists public.papers;
*/
