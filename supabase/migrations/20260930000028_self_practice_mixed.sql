-- ============================================================================
-- Self-practice: a "mixed" set is really mixed. create_self_practice() took
-- unseen questions first across all difficulties, so a student who had seen
-- most easy questions got an all-hard "mixed" set. Now it takes one question
-- of each difficulty in turn (weak topics first and unseen first within each).
-- ============================================================================

create or replace function public.create_self_practice(
  p_class_subject_id uuid,
  p_chapter_ids uuid[],
  p_count int,
  p_difficulty text,
  p_weak_first boolean
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_set uuid;
  v_n int;
  v_today int;
begin
  -- the institute where this student takes this subject
  select e.institute_id into v_inst
  from enrolments e
  join batch_subjects bs on bs.batch_id = e.batch_id and bs.institute_id = e.institute_id
  where e.student_id = auth.uid() and bs.class_subject_id = p_class_subject_id
    and e.institute_id in (select my_institutes())
  limit 1;
  if v_inst is null then
    raise exception 'you are not taking this subject';
  end if;
  if not module_enabled(v_inst, 'self_practice') then
    raise exception 'self-practice is not switched on for your institute';
  end if;
  if p_count is null or p_count < 3 or p_count > 30 then
    raise exception 'choose between 3 and 30 questions';
  end if;
  if coalesce(p_difficulty, '') not in ('mixed', 'easy', 'medium', 'hard') then
    raise exception 'unknown difficulty';
  end if;
  select count(*) into v_today from practice_sets
  where student_id = auth.uid() and institute_id = v_inst and source = 'self' and built_at > now() - interval '1 day';
  if v_today >= 20 then
    raise exception 'you have made 20 practice sets today; try again tomorrow';
  end if;

  insert into practice_sets (institute_id, student_id, class_subject_id, status, source)
  values (v_inst, auth.uid(), p_class_subject_id, 'active', 'self')
  returning id into v_set;

  with weak_topics as (
    select distinct q2.topic_id
    from attempt_items ai
    join attempts a on a.id = ai.attempt_id and a.institute_id = ai.institute_id
    join questions q2 on q2.id = ai.question_id
    where a.student_id = auth.uid() and a.institute_id = v_inst and not ai.is_correct and q2.topic_id is not null
  ),
  pool as (
    select q.id, q.difficulty,
      exists (select 1 from question_exposure x where x.institute_id = v_inst and x.student_id = auth.uid() and x.question_id = q.id) as seen,
      (q.topic_id in (select topic_id from weak_topics)) as weak
    from questions q
    where q.status = 'approved'
      and q.class_subject_id = p_class_subject_id
      and q.owner_institute_id in (platform_institute_id(), v_inst)
      and q.parent_question_id is null
      and q.stimulus_id is null
      and q.question_type in ('mcq', 'assertion_reason', 'vsa', 'sa', 'la')
      and (p_chapter_ids is null or cardinality(p_chapter_ids) = 0 or q.chapter_id = any (p_chapter_ids))
      and (p_difficulty = 'mixed' or q.difficulty = p_difficulty)
      and not exists (
        select 1 from question_flags f
        where f.question_id = q.id and f.institute_id = v_inst and f.status = 'open'
      )
  ),
  ranked as (
    -- within each difficulty: weak topics first (if asked), unseen first, then at random
    select id, difficulty, row_number() over (
      partition by difficulty
      order by (case when coalesce(p_weak_first, false) and weak then 0 else 1 end), seen, random()
    ) as per_level
    from pool
  ),
  picked as (
    -- "mixed" takes one of each difficulty in turn, so a mixed set is mixed
    select id, row_number() over (order by per_level, case difficulty when 'easy' then 0 when 'medium' then 1 else 2 end) as rn
    from ranked
  )
  insert into practice_set_items (institute_id, practice_set_id, question_id, position)
  select v_inst, v_set, id, rn from picked where rn <= p_count;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'no questions match; choose more chapters or another difficulty';
  end if;

  update practice_sets set title = format('Own practice · %s question%s', v_n, case when v_n = 1 then '' else 's' end)
  where id = v_set;

  insert into question_exposure (institute_id, student_id, question_id, context)
  select v_inst, auth.uid(), psi.question_id, 'practice'
  from practice_set_items psi where psi.practice_set_id = v_set
  on conflict (institute_id, student_id, question_id) do nothing;

  return v_set;
end;
$$;
-- DOWN: restore the function from 20260930000027.
