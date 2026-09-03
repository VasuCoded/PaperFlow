-- ============================================================================
-- 0006 · PEOPLE AND ACTIVITY
-- BUILD-PLAN section 5.5. Teacher scoping, batches, enrolment, attempts,
-- practice, exposure, coverage gaps and activation requests. All tenant-scoped.
-- RLS enabled here; interdependent policies live in 0008.
-- ============================================================================

create table public.teacher_subjects (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (institute_id, teacher_id, class_subject_id)
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  name text not null,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  teacher_id uuid references auth.users (id),
  join_code text not null unique,          -- globally unique across all institutes
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, institute_id)
);

-- Enrolment uniqueness is (institute_id, student_id, class_subject_id): a
-- student holds at most one batch per class-subject per institute (5.5, C2).
create table public.enrolments (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  batch_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  joined_at timestamptz not null default now(),
  foreign key (batch_id, institute_id)
    references public.batches (id, institute_id) on delete cascade,
  primary key (institute_id, batch_id, student_id),
  unique (institute_id, student_id, class_subject_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  paper_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  paper_set_id uuid,
  logged_at timestamptz not null default now(),
  source text not null default 'student' check (source in ('student', 'teacher')),
  foreign key (paper_id, institute_id)
    references public.papers (id, institute_id) on delete cascade,
  foreign key (paper_set_id, institute_id)
    references public.paper_sets (id, institute_id),
  unique (id, institute_id),
  unique (institute_id, paper_id, student_id)
);

create table public.attempt_items (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  attempt_id uuid not null,
  question_id uuid not null references public.questions (id),
  is_correct boolean not null,
  display_position int,                 -- for auditing; never the identity
  foreign key (attempt_id, institute_id)
    references public.attempts (id, institute_id) on delete cascade
);

create table public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  built_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'done', 'stale')),
  foreign key (attempt_id, institute_id)
    references public.attempts (id, institute_id) on delete set null,
  unique (id, institute_id)
);

create table public.practice_set_items (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  practice_set_id uuid not null,
  question_id uuid not null references public.questions (id),
  position int not null default 0,
  is_done boolean not null default false,
  self_marked_correct boolean,
  foreign key (practice_set_id, institute_id)
    references public.practice_sets (id, institute_id) on delete cascade
);

-- Exposure is tenant-scoped even for platform-owned questions: a student's
-- exposure at institute A must not stop the question serving at institute B.
create table public.question_exposure (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  context text,
  primary key (institute_id, student_id, question_id)
);

create table public.coverage_gaps (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  difficulty text,
  severity text not null default 'normal' check (severity in ('normal', 'severe')),
  detected_at timestamptz not null default now(),
  note text
);

-- Raised at /institute/subjects, served at /platform/requests (C2b item 5).
create table public.activation_requests (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  requested_by uuid references auth.users (id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  reason text,                          -- decline reason the institute admin sees
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id),
  unique (institute_id, class_subject_id, status)
);

-- Now that batches exists, wire papers.batch_id with a tenant-agreeing FK.
alter table public.papers
  add constraint papers_batch_fk
  foreign key (batch_id, institute_id)
  references public.batches (id, institute_id) on delete set null;

-- ----------------------------------------------------------------------------
-- Join-code generation: 6 chars, uppercase alphanumeric, no O/0/I/1, globally
-- unique. Set on insert when not supplied (C2 item 6).
-- ----------------------------------------------------------------------------
create or replace function public.generate_join_code()
returns text language plpgsql set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no O,0,I,1
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.batches where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.batches_set_join_code()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.join_code is null or new.join_code = '' then
    new.join_code := public.generate_join_code();
  end if;
  return new;
end;
$$;

create trigger batches_set_join_code_bi
  before insert on public.batches
  for each row execute function public.batches_set_join_code();

-- Enable RLS (policies in 0008).
alter table public.teacher_subjects enable row level security;
alter table public.batches enable row level security;
alter table public.enrolments enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_items enable row level security;
alter table public.practice_sets enable row level security;
alter table public.practice_set_items enable row level security;
alter table public.question_exposure enable row level security;
alter table public.coverage_gaps enable row level security;
alter table public.activation_requests enable row level security;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop trigger if exists batches_set_join_code_bi on public.batches;
drop function if exists public.batches_set_join_code();
drop function if exists public.generate_join_code();
alter table public.papers drop constraint if exists papers_batch_fk;
drop table if exists public.activation_requests;
drop table if exists public.coverage_gaps;
drop table if exists public.question_exposure;
drop table if exists public.practice_set_items;
drop table if exists public.practice_sets;
drop table if exists public.attempt_items;
drop table if exists public.attempts;
drop table if exists public.enrolments;
drop table if exists public.batches;
drop table if exists public.teacher_subjects;
*/
