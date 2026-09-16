-- ============================================================================
-- 0009 · ELIGIBLE-POOL FUNCTIONS
--
-- The generator's eligible pool and the teacher's chapter counts must agree
-- exactly. BUILD-PLAN C8: "The chapter counts must show the pool this teacher
-- will actually draw from: shared plus this institute's private, minus flagged.
-- A count that includes questions the generator cannot use will be reported as
-- a bug within a week." The only way to guarantee that is to define the pool
-- ONCE, in SQL, and have both callers use it.
--
-- Also C8 on performance: "chapter coverage counts must be one aggregate query
-- per class-subject, cached for the session, not a query per chapter."
--
-- These are STABLE and SECURITY INVOKER: they run as the caller, so RLS still
-- applies and a teacher can never read another institute's private questions
-- through them.
-- ============================================================================

-- The pool predicate, in one place.
--   * approved only
--   * owner is the platform (shared bank) or this institute (private layer)
--   * not flagged open by THIS institute (a flag suppresses for the raiser only)
--   * optionally excluding questions used in this teacher's last N papers
create or replace function public.eligible_questions(
  p_institute_id uuid,
  p_class_subject_id uuid,
  p_chapter_ids uuid[] default null,
  p_teacher_id uuid default null,
  p_exclude_recent_papers int default 0
)
returns table (
  id uuid,
  owner_institute_id uuid,
  class_subject_id uuid,
  chapter_id uuid,
  topic_id uuid,
  strand_id uuid,
  stimulus_id uuid,
  parent_question_id uuid,
  part_label text,
  body text,
  question_type text,
  marks int,
  difficulty text,
  source text,
  options_shufflable boolean,
  position_locked boolean
)
language sql stable
set search_path = public
as $$
  with recent as (
    select pq.question_id
    from public.paper_questions pq
    where p_exclude_recent_papers > 0
      and p_teacher_id is not null
      and pq.paper_id in (
        select pa.id from public.papers pa
        where pa.institute_id = p_institute_id
          and pa.teacher_id = p_teacher_id
          and pa.class_subject_id = p_class_subject_id
        order by pa.created_at desc
        limit p_exclude_recent_papers
      )
  )
  select q.id, q.owner_institute_id, q.class_subject_id, q.chapter_id, q.topic_id,
         q.strand_id, q.stimulus_id, q.parent_question_id, q.part_label,
         q.body, q.question_type, q.marks, q.difficulty, q.source,
         q.options_shufflable, q.position_locked
  from public.questions q
  where q.status = 'approved'
    and q.class_subject_id = p_class_subject_id
    and q.owner_institute_id in (public.platform_institute_id(), p_institute_id)
    and (p_chapter_ids is null or q.chapter_id = any (p_chapter_ids))
    and not exists (
      select 1 from public.question_flags f
      where f.question_id = q.id
        and f.institute_id = p_institute_id
        and f.status = 'open'
    )
    and q.id not in (select question_id from recent)
$$;

-- One aggregate for the whole class-subject, over exactly the same pool.
create or replace function public.chapter_pool_counts(
  p_institute_id uuid,
  p_class_subject_id uuid
)
returns table (chapter_id uuid, chapter_name text, sort_order int, approved bigint)
language sql stable
set search_path = public
as $$
  select c.id, c.name, c.sort_order, count(e.id) as approved
  from public.chapters c
  left join public.eligible_questions(p_institute_id, p_class_subject_id) e
    on e.chapter_id = c.id
  where c.class_subject_id = p_class_subject_id
  group by c.id, c.name, c.sort_order
  order by c.sort_order, c.name
$$;

grant execute on function
  public.eligible_questions(uuid, uuid, uuid[], uuid, int) to authenticated;
grant execute on function
  public.chapter_pool_counts(uuid, uuid) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.chapter_pool_counts(uuid, uuid);
drop function if exists public.eligible_questions(uuid, uuid, uuid[], uuid, int);
*/
