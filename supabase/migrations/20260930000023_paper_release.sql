-- ============================================================================
-- Papers reach students only once the teacher releases them.
--
-- A paper is usually set (and assigned to its batch) days before the test is
-- sat. Students must not see it in the app until the teacher says the test
-- has been conducted: papers.released_at, null until then.
--
-- Everything a student can read of a paper (the paper, its questions, sets and
-- blocks) and logging an attempt against it goes through can_access_paper(),
-- so the rule lives there, once. Teachers and admins are unaffected.
--
-- Safe to apply before the app that uses it: the column defaults to now(), so
-- a paper saved by an app that does not know about release is visible at once,
-- as before. The new app saves papers with released_at = null explicitly.
-- Every existing paper counts as released (nothing students see today goes).
-- ============================================================================

alter table public.papers add column released_at timestamptz default now();
update public.papers set released_at = coalesce(generated_at, created_at, now()) where released_at is null;

comment on column public.papers.released_at is
  'When the teacher marked the paper as conducted; students see it only after this. Null = not yet released.';

create or replace function public.can_access_paper(p_paper_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.institute_id in (select public.my_institutes())
      and (
        public.my_role(p.institute_id) in ('teacher', 'institute_admin')
        or (
          p.released_at is not null
          and exists (
            select 1 from public.enrolments e
            where e.student_id = auth.uid()
              and e.institute_id = p.institute_id
              and e.class_subject_id = p.class_subject_id
          )
        )
      )
  )
$$;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
create or replace function public.can_access_paper(p_paper_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.institute_id in (select public.my_institutes())
      and (
        public.my_role(p.institute_id) in ('teacher', 'institute_admin')
        or exists (
          select 1 from public.enrolments e
          where e.student_id = auth.uid()
            and e.institute_id = p.institute_id
            and e.class_subject_id = p.class_subject_id
        )
      )
  )
$$;
alter table public.papers drop column released_at;
*/
